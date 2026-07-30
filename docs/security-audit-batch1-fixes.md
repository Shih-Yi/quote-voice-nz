# 全專案安全審查 — 第一批修復

本文記錄 2026-07-31 全專案 code review（`/code-audit`）第一批修掉的問題，
格式沿用 [quote-crud-review-fixes.md](./quote-crud-review-fixes.md)：
「白話問題 → 怎麼解決 → 改了什麼」。

審查涵蓋 12 支 API route、RLS/migrations、Stripe 金流、AI pipeline、
NZ 業務邏輯與離線層，共 19 項發現。本批處理其中 4 項最高風險者
（2 CRITICAL + 2 產品/隱私決策）。其餘見文末「未處理」。

驗證：`tsc --noEmit` 乾淨、`vitest` 372 passed（原 345，新增 27）、
`next build` 成功、`eslint` 與改動前基準一致（6 errors / 8 warnings，皆為既有問題）。

---

## 🔴 Critical

### 1. 任何登入者可繞過 `/api/quotes` 直接寫入報價，並塞進別人的帳號

**問題**

migration 002 建的 `quotes_insert` policy，`WITH CHECK` 只檢查三個欄位非空：

```sql
customer_name != '' AND slug != '' AND owner_token_hash != ''
```

**完全沒有檢查 `user_id`，也沒有限制 role**。再加上同一支 migration 的
`GRANT SELECT, INSERT, UPDATE, DELETE ON api.quotes TO authenticated`，
而瀏覽器 client 用公開的 anon key 直連 `api` schema
（`lib/supabase/client.ts`）—— 任何登入使用者在 devtools 就能寫：

```js
supabase.from('quotes').insert({ ..., user_id: '<別人的 uuid>' })
```

`/api/quotes` 裡辛苦做的每一道防線都被整條繞過：月配額閘門、字串長度上限、
伺服器端 `items_sum` 重算、status regression guard、擁有權綁定。更糟的是
`user_id` 可任填，而 SELECT policy 是 `user_id = auth.uid()`，所以那筆會出現在
**受害者的** dashboard 裡。

migration 014 當時只收緊了 SELECT，寫入 policy 從 002 之後沒再動過。

**怎麼解決**

兩層一起上。先把直接寫入的 grant 收掉 —— 全部寫入路徑早就走 service_role
的 API route（`/api/quotes` POST/DELETE、`/api/quotes/bind`、`/api/accept-quote`），
前端唯一的直接存取是 `getQuoteByIdFromSupabase` 的 SELECT，保留即可。
再把 `quotes_insert` 補上 `user_id = auth.uid()`，這樣就算未來有人重新 grant
INSERT，也不會靜默地把洞開回來。

**改了什麼**

- `supabase/migrations/017_lock_down_quotes_writes.sql` — 新增

---

### 2. `/api/send-quote` 是一個開放的郵件轉發器

**問題**

收件人、寄件人顯示名、連結網址、金額、客戶姓名 —— 全部由 request body 指定，
而且 route **根本收不到 quote id**，也就無從驗證這封信跟哪張報價有關、
發送者是否擁有它。

任何免費帳號登入後打一次 API：

```json
{ "to": "victim@example.nz", "providerName": "ANZ Internet Banking",
  "quoteUrl": "https://phish.example/login" }
```

就能從你**已驗證的網域**寄出一封顯示寄件人為 "ANZ Internet Banking"、
CTA 指向釣魚站的信。`providerName` 還被直接插進
`from: \`${fromName} <${fromEmail}>\`` —— 含換行或角括號時就是 header injection。

附帶兩個問題：配額在 `try` 之外就先扣，Resend 沒設定或送信失敗照樣扣掉額度；
沒有冪等鍵，連點兩下寄兩封、扣兩點。

**怎麼解決**

改成只收 `quoteId`（`to` 選填，不給就用報價上的客戶 email）。伺服器據此撈出
報價列並驗證擁有權，信裡每一個字 —— 連結、金額、客戶姓名、寄件人名稱 ——
一律從 DB 和 profile 取，客戶端無法左右任何內容。連結由 `NEXT_PUBLIC_APP_URL`
（fallback 到 request origin）組出，不碰 body。寄件人顯示名經
`sanitiseDisplayName` 剝掉 `\r\n` 與 `"<>,;:`，長度截到 78 字元。

同時擋掉草稿（公開 RPC 只解析 sent/accepted，寄草稿等於給客戶一個死連結），
配額改成「送出前檢查、成功後才扣」，並以 `(user, quoteId, 收件人)` 做 60 秒冪等。

**改了什麼**

- `app/api/send-quote/route.ts` — 重寫
- `components/quote/QuoteShare.tsx` — payload 改送 `{ quoteId, to }`
- `app/api/send-quote/__tests__/route.test.ts` — 新增 16 個測試

---

## 🟠 隱私 / 產品決策

### 3. 公開報價連結會把師傅的銀行帳號送給任何拿到連結的人

**問題**

migration 011 在 `get_quote_by_slug` 加了 `owner_bank_account`，理由寫的是
「反正付費報價的 `provider_details` 裡本來就有」。但那支 RPC 是
`SECURITY DEFINER` 且 grant 給 `anon`，欄位是**無條件**回傳的 —— 不分方案、
不分該張報價師傅有沒有選擇露出帳號。`lib/supabase/quotes.ts` 把它合併進
`ownerProfile`，`QuotePDF.tsx` 再印成 "Bank: xxx" 寫進可下載的 PDF。
連結一被轉傳，帳號就跟著走。

報價不是發票。付款資訊屬於客戶要付款的那份文件，不是每一張寄出去的報價。

**怎麼解決**

把 `owner_bank_account` 從 RPC 的回傳中拿掉。客戶識別與聯絡師傅需要的欄位
（商號、電話、email、地址）全部保留。

**注意不受影響的部分**：`quotes.provider_details` 這個 JSONB 是師傅在
`QuoteForm` 裡**逐張報價主動填入**的快照，裡面有 bankAccount 是他自己的選擇，
維持原狀。這次移除的只是從 `api.profiles` **自動 JOIN** 出來、他從未針對
單張報價同意過的那一份。

**改了什麼**

- `supabase/migrations/018_get_quote_by_slug_no_bank_account.sql` — 新增
- `lib/supabase/quotes.ts` — 移除 `owner_bank_account` 型別與對應

---

### 4. free tier 的付費牆擋在客戶臉上，而客戶無能為力

**問題**

客戶按下 Accept 後才收到「Quote acceptance requires a Pro or Team plan.
Please ask the tradie to upgrade.」。這訊息給錯了對象 —— 屋主既不能升級，
也不該知道師傅的付費狀態。實際效果是傷害使用者的專業形象，而且師傅往往
要等客戶抱怨才知道有這個限制。順帶一提，那句話等於向第三方洩漏使用者的
訂閱層級。

**怎麼解決**

閘門從「客戶按下 Accept 時」移到「師傅寄出前」。

- 師傅端：`QuoteShare` 在 free tier 顯示說明 —— 客戶可以看報價但不能線上接受，
  會用電話或簡訊回覆；附升級 CTA。**不阻擋寄送**。
- 客戶端：`/q/[slug]` 在師傅非付費方案時直接不渲染 Accept 按鈕，
  改顯示「Ring <商號> to accept」的撥號按鈕（有電話時），客戶完全察覺不到限制。
- API：`/api/accept-quote` 的 403 保留（防直接打 API），但訊息改成中性的
  「This quote can't be accepted online. Please contact the sender directly.」，
  不再洩漏方案等級。

`ownerTier` 未解析時（離線）一律當作不可接受，不會渲染一個按了會 403 的按鈕。

**改了什麼**

- `types/quote.ts` — `Quote` 加 `ownerTier?: "free" | "pro" | "team"`
- `lib/supabase/quotes.ts` — 新增 `normaliseTier`（未知值一律降為 free，
  不會因為 DB 出現意外值就 fail open 到付費層），回傳 `ownerTier`
- `lib/storage/quotes.ts` — `getQuoteBySlug` 合併時帶上 `ownerTier`
- `app/q/[slug]/page.tsx` — `canAcceptOnline` 判斷 + 撥號 fallback
- `app/api/accept-quote/route.ts` — 中性錯誤訊息
- `components/quote/QuoteShare.tsx` — free tier 事前說明
- `lib/supabase/__tests__/quotes-public.test.ts` — 新增 6 個測試
- `app/api/accept-quote/__tests__/route.test.ts` — 新增 5 個測試

---

## 部署注意

migration 017 / 018 需要套用到 Supabase。兩支都是冪等的，可重複執行。

**017 的行為變更**：`authenticated` 角色失去 `api.quotes` 的 INSERT/UPDATE/DELETE。
已確認前端唯一的直接表存取是 `getQuoteByIdFromSupabase` 的 SELECT（保留），
其餘寫入全走 service_role，不受影響。SECURITY DEFINER 的 legacy RPC
（`create_quote`、`update_quote_anon`、`delete_quote_anon`）以函式擁有者身分
執行，也不受 grant 變更影響。

**018 的行為變更**：公開報價頁不再自動顯示師傅 profile 上的銀行帳號。
若師傅希望客戶看到帳號，需在該張報價的 provider details 中填入。
這是刻意的行為變更，若要維持舊行為需回退此 migration。

---

## 後續批次

第二批（正確性）**已完成** —— 見
[security-audit-batch2-fixes.md](./security-audit-batch2-fixes.md)：
GST 浮點誤差、語音報價 GST 預設、transcribe 配額扣點時機。

第三批（成本與韌性，未處理）：
- 匿名使用者在 `/api/quotes` 無月配額；`cleanup_anon_orphan_quotes` 未排程
- `GLOBAL_DAILY_TRANSCRIBES: 200` 寫死且與付費用戶共用；costGuard RPC 失敗一律 fail-open
- slug 與 device token 使用 `Math.random()`，應改 CSPRNG 並加長 slug
- `/api/extract` 的 `text` 無長度上限
- Stripe webhook 無事件去重與亂序保護
- `/api/checkout` 無限流、試用期無條件發放
- 7 處回傳 provider 原始錯誤訊息
- confidence < 0.6 僅 toast，未實作 CLAUDE.md 的 Validation Mode
