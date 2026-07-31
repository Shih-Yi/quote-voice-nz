# 全專案安全審查 — 第三批修復（成本與韌性）

接續 [batch1](./security-audit-batch1-fixes.md)（安全）與
[batch2](./security-audit-batch2-fixes.md)（正確性）。本批清掉剩餘 9 項，
審查的 19 項發現至此全部處理完畢。

驗證：`tsc --noEmit` 乾淨、`vitest` 456 passed（第二批後 406，新增 50）、
`next build` 成功、`eslint` 與基準一致（6 errors / 8 warnings，皆為既有問題）。

---

### 1. 分享連結與匿名 token 用 `Math.random()`

**問題**

三處識別碼都靠 `Math.random()` —— 非密碼學 PRNG，內部狀態可從少量輸出還原。
而這兩種識別碼的「不可猜測性」本身就是安全邊界：

- **slug** 是 `/q/[slug]` 唯一的閘門。`get_quote_by_slug` 是 SECURITY DEFINER
  且 grant 給 anon，拿到 slug 就讀得到客戶姓名、電話、email、地址。
- **device token** 是匿名報價唯一的擁有權憑證。

slug 還只有 8 個 base36 字元 ≈ 2^41。找到**任一張**有效報價的期望嘗試次數是
`36^8 / 報價總數` —— 累積到 10 萬張時約 2800 萬次，是幾小時的工作量，不是幾世紀。

**怎麼解決**

新增 `lib/utils/randomId.ts`，統一用 `crypto.getRandomValues`，slug 加長到
16 字元（≈ 2^82.7）。既有的 8 字元 slug 仍然有效，只有新產生的變長；
device token 維持 `dt_` + 32 字元的格式，已存在裝置上的不受影響。

取字元時做 rejection sampling —— `256 % 36 = 4`，直接 `byte % 36` 會讓
前四個字母多出約 1.6% 的機率。

順帶把 `/api/quotes` 缺少的 `slug` 驗證補上（`^[a-z0-9]{6,32}$`，相容舊格式），
以及 `providerDetails` 的序列化大小上限。

**測試抓到的 bug**：`crypto.getRandomValues` 單次上限 65,536 bytes，超過會丟
`QuotaExceededError`。實務上 slug 只有 16 字元踩不到，但 helper 是通用的，
已改成分批抽取。

**改了什麼**

- `lib/utils/randomId.ts` — 新增
- `lib/storage/deviceToken.ts`、`lib/storage/quotes.ts`、`app/api/quotes/route.ts`
- `lib/utils/__tests__/randomId.test.ts` — 新增 23 個測試，含分佈偏差檢查

---

### 2. 匿名使用者在 `/api/quotes` 完全沒有配額

**問題**

語音路徑被 `/api/transcribe` 的裝置 3/日、IP 5/日擋著，但**手打的報價根本不經過
那條路**。匿名者在 `/api/quotes` 只受 30/min 的 burst 限制，等於一天可以塞四萬多筆
雲端報價 —— 而這些正是 `cleanup_anon_orphan_quotes` 要清的、沒有人可以被收費的資料列。

**怎麼解決**

用既有的 `costGuard` 機制加上獨立 scope 的每日上限（裝置 10/日、IP 20/日）。
額度比語音寬鬆，因為打字不花 Groq 的錢，這裡防的是資料表膨脹。
撞到上限時回 `action: "login_required"`，前端已有處理這個訊號的邏輯，
等於順便多一個註冊轉換點。

不需要客戶端改動 —— `body.token` 本來就是 device token。

**改了什麼**

- `lib/costGuard.ts` — 新增 `checkAnonQuoteDeviceQuota` / `checkAnonQuoteIpQuota`
- `app/api/quotes/route.ts` — 新報價的匿名閘門
- `app/api/quotes/__tests__/route.test.ts` — 新增 4 個測試

---

### 3. 全域轉錄上限寫死、與付費用戶共用、且失敗時 fail-open

**問題**

`GLOBAL_DAILY_TRANSCRIBES: 200` 是寫死的常數，且匿名、免費、付費全共用同一個計數器。
40 個匿名 IP 就能吃光當天額度，讓付費用戶整天看到
「Service is at capacity for today」。

而 `consume` 在 RPC 出錯時一律 fail-open —— 對 per-user 的公平性限制這是對的，
但**全域上限的唯一職責就是防止 Groq 支出失控**，Supabase 一抖動這道防線就消失，
偏偏那正是最可能需要它的時候。

**怎麼解決**

- 拆成 `GLOBAL_DAILY_TRANSCRIBES_FREE` / `_PAID` 兩個獨立池，匿名流量再多也
  吃不到付費用戶的額度。
- 所有上限改成 env 可調（`KSQ_*`），寫死的天花板遲早會變成事故。
- `consume` 加上 `onFailure` 選項：per-user / per-device 維持 fail-open，
  全域上限改 fail-closed，但在放棄之前先退到 **Upstash Redis** ——
  它跟 Supabase 是獨立的故障域，兩邊都掛才拒絕。

`/api/transcribe` 相應調整成先辨識使用者、取一次 tier（原本重複查兩次），
再決定要計入哪個池。

**改了什麼**

- `lib/costGuard.ts` — 雙池、env 化、Redis 備援、`onFailure` 語意
- `app/api/transcribe/route.ts` — tier 只查一次並傳入全域閘門

---

### 4. `/api/extract` 的 `text` 沒有長度上限

**問題**

成本護欄只數**次數**，不管**大小**。一個 500KB 的 body 約是 gpt-4o-mini
的 12.5 萬 token，而這支 route 允許 15 次/分鐘。

**怎麼解決**

上限 20,000 字元（約兩分鐘錄音逐字稿的 20 倍），超過回 413。

**改了什麼**

- `app/api/extract/route.ts`、`app/api/extract/__tests__/route.test.ts`（+2）

---

### 5. Stripe webhook 沒有去重，也沒有亂序保護

**問題**

簽章驗證是對的，但之後每個事件都無條件套用。Stripe 在任何非 2xx 會重送，
成功後也可能重送；而且**明確不保證送達順序**。
`customer.subscription.deleted` 先處理、較早發出的 `updated`（status=active）
後到 → 已取消的帳號被還原成付費層。

**怎麼解決**

migration 019 新增 `api.stripe_events` 記錄已處理的事件 id（重送直接 ack 略過），
並在 `api.subscriptions` 加 `last_stripe_event_at`，早於它的事件一律丟棄。

**一個容易漏掉的細節**：事件 id 是在做事**之前**認領的，所以 handler 失敗時
必須把認領釋放掉 —— 否則 Stripe 的重送會被當成重複而永久丟失該筆帳務變更。
`releaseStripeEvent` 就是做這件事的。

**改了什麼**

- `supabase/migrations/019_stripe_event_ordering.sql` — 新增
- `lib/supabase/subscription.ts` — `claimStripeEvent` / `releaseStripeEvent` /
  `getLastStripeEventAt`；`upsertSubscription` 記錄事件時間
- `app/api/webhooks/stripe/route.ts`
- `app/api/webhooks/stripe/__tests__/route.test.ts` — 新增 7 個測試

---

### 6. `/api/checkout` 無限流，且 14 天試用可以無限重領

**問題**

全專案唯一沒有 route 層限流的變動型 route。更嚴重的是
`trial_period_days: 14` 是無條件給的 —— 訂閱、在試用期內取消、再訂閱，
就再拿 14 天，可以永遠不付錢。

**怎麼解決**

補 10 次/分鐘限流。試用改成：只要帳號有過任何 Stripe 關係
（customer id、subscription id，或曾記錄過 trial），就不再給試用期。

**改了什麼**

- `app/api/checkout/route.ts`

---

### 7. 七處把 provider 的原始錯誤訊息回給客戶端

**問題**

`return NextResponse.json({ error: error.message }, { status: 500 })` ——
Postgres 訊息會帶 schema、表、欄位、約束名稱；OpenAI / Groq 的會帶 model 名稱、
org id、request id。`/api/transcribe` 更是直接回
「Invalid API key. Please check your GROQ_API_KEY.」，把供應商和環境變數名稱
一起告訴任何能觸發它的人。

**怎麼解決**

全部改成通用訊息，細節只進 `console.error` 與 Sentry。API key 錯誤是**我們的**
設定問題不是呼叫者的，改回 503 而非 401。

**改了什麼**

- `app/api/quotes/route.ts`（2 處）、`app/api/quotes/bind/route.ts`（2 處）、
  `app/api/profile/route.ts`、`app/api/extract/route.ts`、`app/api/transcribe/route.ts`
- 兩支測試改為斷言「不洩漏」，而非只看狀態碼

---

### 8. `/api/profile` PUT 零驗證，含 NZ 銀行帳號格式

**問題**

`fullName` / `businessName` / `phone` / `email` / `address` / `bankAccount`
全部直接進資料庫：沒有長度上限、沒有型別檢查、沒有 email 格式，
**也沒有 CLAUDE.md 明文要求的 NZ 銀行帳號格式驗證**。
而這個帳號會經由報價的 provider details 送到客戶眼前 —— 填錯就是匯錯錢。

**怎麼解決**

新增 `lib/schemas/profile.ts`，用 zod 驗證。銀行帳號比對
`^\d{2}-\d{4}-\d{7}-\d{2,3}$`（CLAUDE.md 寫的是兩位後綴，實務上也發三位，兩者都收）。
空字串視為「清除該欄位」而非驗證失敗。

**改了什麼**

- `lib/schemas/profile.ts` — 新增
- `app/api/profile/route.ts`
- `lib/schemas/__tests__/profile.test.ts` — 新增 20 個測試

---

### 9. confidence < 0.6 只跳一個 toast；ASR 失敗沒有觸覺回饋

**問題**

CLAUDE.md 的錯誤處理規格要求低信心時進入「Validation Mode」：標示不確定的欄位、
黃色警示、one-tap confirm。實作只有一個 `toast.warning`，而且
**`confidence` 根本沒有寫進 Quote 物件**，所以報價頁拿不到這個值，
不可能做任何標示。toast 在使用者走到那些欄位之前就消失了。

ASR 失敗的高優先規格要求觸覺回饋，全專案 `grep vibrate` 零結果 ——
師傅單手拿著手機、在吵雜工地，很可能沒在看螢幕。

**怎麼解決**

- `Quote` 新增 `extractionConfidence`，語音流程寫入。
- 報價頁在低於門檻時顯示黃色驗證橫幅，含「Looks right」（清除分數，
  之後不再嘮叨）與「Fix details」兩個動作。
- 新增 `lib/utils/haptics.ts`，ASR 失敗震動兩短下、成功震一下。
  Vibration API 支援度不一（iOS Safari 完全不支援），全部 best-effort。

**改了什麼**

- `types/quote.ts` — `extractionConfidence` + `LOW_CONFIDENCE_THRESHOLD`
- `lib/utils/haptics.ts` — 新增
- `components/voice/VoiceRecorder.tsx`、`app/quote/[id]/page.tsx`

---

## 部署注意

**migration 019 需要套用**（017 / 018 若尚未套用也一併）。

019 會嘗試用 pg_cron 排程兩個清理工作 —— 包含 migration 013 寫好卻一直沒排程的
`cleanup_anon_orphan_quotes`。若該 Supabase 方案沒有 pg_cron，migration 仍會成功，
但會 `RAISE NOTICE` 提醒需要用外部排程器呼叫。

**新增的 env（全部可選，有預設值）**

| 變數 | 預設 | 說明 |
|---|---|---|
| `KSQ_GLOBAL_DAILY_TRANSCRIBES_FREE` | 200 | 匿名 + 免費層共用池 |
| `KSQ_GLOBAL_DAILY_TRANSCRIBES_PAID` | 2000 | 付費層獨立池 |
| `KSQ_ANON_DEVICE_DAILY` | 3 | 匿名每裝置轉錄 |
| `KSQ_ANON_IP_DAILY` | 5 | 匿名每 IP 轉錄 |
| `KSQ_ANON_QUOTE_DEVICE_DAILY` | 10 | 匿名每裝置建立報價 |
| `KSQ_ANON_QUOTE_IP_DAILY` | 20 | 匿名每 IP 建立報價 |

**行為變更**：全域上限在 Supabase 與 Upstash 都無法連線時改為**拒絕**請求
（原本是放行）。這是刻意的 —— 該上限存在的唯一目的就是防止支出失控。

---

## 審查結案

19 項發現全部處理完畢。仍建議在 Groq / OpenAI 後台設帳戶層級的月支出上限 ——
那是唯一不依賴本專案程式碼正確性的防線。
