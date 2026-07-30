# 全專案安全審查 — 第二批修復（正確性）

接續 [security-audit-batch1-fixes.md](./security-audit-batch1-fixes.md)。
本批處理 3 項「算錯 / 扣錯」類問題，都不是安全漏洞，但直接影響使用者拿到的數字。

驗證：`tsc --noEmit` 乾淨、`vitest` 388 passed（第一批後 372，新增 16）、
`next build` 成功、`eslint` 與基準一致（6 errors / 8 warnings，皆為既有問題）。

---

### 1. 師傅看到的 GST 和客戶看到的差 1 分錢

**問題**

同一張報價有兩套算法在跑：

- 師傅端（編輯畫面、本地 PDF）用 `lib/utils/gst.ts` 的
  `Math.round(value * 100) / 100`
- 客戶端（`/q/[slug]` 公開頁）顯示的是資料庫 GENERATED 欄位的值，
  由 `lib/supabase/quotes.ts` 直接對應

Postgres 在 `NUMERIC` 上運算是精確十進位、逢五進位；JS 是 IEEE-754 二進位浮點，
先把值轉成近似值再四捨五入。兩者在 `.xx5` 邊界不一致。

實測 1 到 100000 分的全部金額，**1302 組發散**，而且都是很常見的價格：

| items_sum | 師傅看到的 GST | 客戶看到的 GST |
|---|---|---|
| $1.50 | 0.22 | 0.23 |
| $3.30 | 0.49 | 0.50 |
| $33.30 | 4.99 | 5.00 |

師傅留存的紀錄與客戶收到的正式報價金額對不上，爭議時沒有單一真相。

**怎麼解決**

把 `lib/utils/gst.ts` 改成整數分運算，並把資料庫的三條公式原樣搬過來：

```
exclusive:  subtotal = S            gst = round(S*15/100)   total = round(S*115/100)
inclusive:  subtotal = round(S*20/23)   gst = round(S*3/23)     total = S
```

（S = items_sum 的分）。`divideRound(a, b)` 用 `floor((2a + b) / (2b))` 實作
「四捨五入、逢五遠離零」，與 Postgres `ROUND()` 對 NUMERIC 的行為一致，
且全程整數不碰浮點。

順帶把 `/api/quotes` 的 `items_sum` 也改成整數分加總 —— 原本是把 2dp 浮點相加
再最後 round 一次，項目多時會累積誤差；現在伺服器與本地是同一套算法。

`calculateTotal(subtotal, gst)` 維持原樣，它是通用加總工具、輸入不保證 2dp，
在資料庫沒有對應欄位。

**改了什麼**

- `lib/utils/gst.ts` — 改寫為整數分；新增匯出 `calculateItemTotal`、`roundToTwo`
- `app/api/quotes/route.ts` — `items_sum` 改整數分加總
- `lib/utils/__tests__/gst.test.ts` — 新增 8 個測試，含兩種模式各 10 萬個金額
  對照獨立實作的 Postgres 公式做窮舉比對、`subtotal + gst == total` 不變式、
  以及 300 個 $0.10 項目不累積浮點誤差

---

### 2. 語音報價一律用 GST-exclusive ⚠️ 行為變更

**問題**

`VoiceRecorder.tsx` 與 `useOfflineStorage.ts` 都把 `gstInclusive` 寫死 `false`。

紐西蘭的慣例分得很清楚：報價給屋主（B2C）用 **GST-inclusive**，
客戶看到的價格就是他要付的錢；報價給建商、物業管理等 GST 註冊企業（B2B）
才用 exclusive。本專案主要客群是水電、電工、園藝，客戶以屋主為主 ——
寫死 exclusive 剛好選到較不合適的那一邊。

（面向消費者的標價是否必須含 GST，涉及 Fair Trading Act 的適用範圍，
請與會計師或律師確認；此處只依循業界慣例調整預設值。）

**怎麼解決**

新增 `lib/storage/preferences.ts`，記住師傅上次用的模式，新報價沿用。
沒有選過的人從 **inclusive** 開始。

刻意存在 IndexedDB 而非 profiles：語音流程必須離線可用、匿名也能用，
兩者都連不到 `/api/profile`。也刻意不做新的設定頁 —— 師傅在 `QuoteForm`
切換 GST 時就順手記住了，不需要額外設定任何東西。

**同時修掉的不一致**：`useOfflineStorage.ts` 的離線重播路徑算 line item total
時**沒有做四捨五入**（`i.quantity * i.unitPrice`），而即時語音路徑有
（`.toFixed(2)`）。同一支錄音走不同路徑會存進不同的值。兩邊現在都用
`calculateItemTotal`。

**行為變更**：既有使用者的**新**語音報價會從 GST-inclusive 開始，
與過去不同。已建立的報價不受影響。要還原成 exclusive，改
`lib/storage/preferences.ts` 的 `DEFAULT_GST_INCLUSIVE`。

**改了什麼**

- `lib/storage/preferences.ts` — 新增
- `components/voice/VoiceRecorder.tsx` — 讀偏好；line item 改用 `calculateItemTotal`
- `hooks/useOfflineStorage.ts` — 同上，並修掉未四捨五入的 line item total
- `components/quote/QuoteForm.tsx` — 切換 GST 時記住選擇
- `lib/storage/__tests__/preferences.test.ts` — 新增 6 個測試

---

### 3. 轉錄失敗照樣扣每日配額，離線重試每次再扣一次

**問題**

`/api/transcribe` 的註解白紙黑字寫著
*"increment only after success to avoid wasting quota on a failed API call"*，
但 `consumeUserDailyQuota` 在第 133 行就執行了，Groq 呼叫在第 153 行。
**程式碼與註解相反。**

實際後果：師傅在收訊差的工地錄音 → 扣配額 → Groq 逾時 → 500 →
錄音進 pending queue → `flushQuoteQueues` 每 60 秒重試 → **每次重試再扣一次**。
free tier 的 `quotesPerDay` 可能被單一支錄音耗光，而師傅一張報價都沒拿到。
這正是這個 App 主打的使用情境。

**怎麼解決**

改成 peek-then-consume：Groq 呼叫前用 `peekUserDailyQuota` 擋掉超額請求
（不花錢就先拒絕），轉錄成功回來之後才 `consumeUserDailyQuota`。

`peekUserDailyQuota` 本來就存在（`/api/extract` 在用），不需要新增機制。
`/api/extract` 依賴 transcribe 擁有 increment 的約定不變。

競態處理與 `/api/quotes` 一致：peek 過了但 consume 時額度已被併發請求用掉，
就記 log 並照常回傳轉錄結果 —— Groq 的錢已經花了，不該把使用者應得的東西丟掉。

**改了什麼**

- `app/api/transcribe/route.ts` — peek 前置、consume 後置，修正誤導的註解
- `app/api/transcribe/__tests__/route.test.ts` — 補 `peekUserDailyQuota` mock，
  新增 2 個測試（Groq 失敗不扣配額、競態時仍回傳結果）

---

## 未處理（第三批：成本與韌性）

- 匿名使用者在 `/api/quotes` 無月配額；`cleanup_anon_orphan_quotes` 未排程
- `GLOBAL_DAILY_TRANSCRIBES: 200` 寫死且與付費用戶共用；costGuard RPC 失敗一律 fail-open
- slug 與 device token 使用 `Math.random()`，應改 CSPRNG 並把 slug 加長（目前 ≈ 2^41）
- `/api/extract` 的 `text` 無長度上限
- Stripe webhook 無事件去重與亂序保護
- `/api/checkout` 無限流、試用期無條件發放（可重複拿 14 天）
- 7 處回傳 provider 原始錯誤訊息
- confidence < 0.6 僅 toast，未實作 CLAUDE.md 的 Validation Mode；ASR 失敗無觸覺回饋
- 只有 1 支 route 用 zod，其餘手刻驗證；`/api/profile` PUT 零驗證（含 NZ 銀行帳號格式）
