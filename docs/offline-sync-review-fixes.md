# 離線同步 & Supabase Review — 問題與修復

本文記錄這輪離線功能 / Supabase 同步審查修掉的所有問題，格式沿用
[quote-crud-review-fixes.md](./quote-crud-review-fixes.md)：「白話問題 → 怎麼解決 → 改了什麼」。

審查範圍：IndexedDB 儲存層、同步佇列、API routes、RLS migrations、Service
Worker、Auth 流程。共 12 項，分三輪修復（Critical → High/Medium → Low）。

相關 commits（分支 `claude/offline-sync-audit`）：
- `9e22418` Critical — 驅動重試佇列、離線錄音先存後傳、保留只存在本地的欄位（第 1–3 項）
- `95b0cdd` High/Medium — `cloudSyncedAt` 追蹤、可重試性分類、匿名刷新、分享閘門（第 4–7 項）
- 本次 commit — Low + 本文件（第 8–12 項）

每輪都各自跑過 `vitest` / `tsc --noEmit` / `next build`：
330 → 335 → 345 tests passed。

---

## 🔴 Critical

### 1. 離線重試佇列從來沒有被執行

**問題**
`syncPendingQuotes` / `syncPendingDeletions` 有完整的 retry + 指數退避機制，
註解也寫著「call this on app launch or when coming online」—— 但整個專案**只有
測試檔在呼叫它們**，也沒有任何 `online` 事件監聽器。

後果很嚴重：語音建立的報價走 `saveQuote(..., { localOnly: true })` 進入 sync
queue，**永遠不會上雲**，除非使用者之後剛好又編輯儲存一次。UI 那句「Will retry
automatically」是空話。Dashboard 的 "Sync All" 也只處理待轉錄的錄音，不碰報價佇列。

**怎麼解決**
補上真正的驅動者。`flushQuoteQueues()` 依序跑刪除佇列再跑同步佇列（先刪後同步，
避免同一個 id 在單次 pass 內被復活），並用 Web Locks API 做跨分頁互斥，兩個分頁
同時開著不會重複 POST。`useBackgroundSync` 在 app 開機、`online` 事件、每 60 秒
各觸發一次；佇列為空時只是兩次 IndexedDB 讀取，成本可忽略。

**改了什麼**
- `lib/storage/backgroundSync.ts` — 新增 `flushQuoteQueues` / `flushChangedAnything`
- `hooks/useBackgroundSync.ts` — 新增，掛載於 `components/Providers.tsx`
- `lib/events.ts` — 新增 `QUOTES_CHANGED` 事件常數
- `app/dashboard/page.tsx` — "Sync All" 一併 flush 報價佇列

---

### 2. 完全離線時錄音會直接遺失，UI 卻說「已儲存」

**問題**
`addPendingAudio` 只在 `!transcribeRes.ok`（有收到 HTTP 回應）時執行。但**完全斷網
時 `fetch` 是直接 reject 的**，根本拿不到 response，程式跳進 catch —— 而 catch 裡
沒有任何保存動作，卻 toast「Saved offline — Quote will sync when connected」，接著
`resetRecording()` 把 blob 丟掉。壓縮失敗也是同樣下場。

對一個主打「Canterbury 偏遠地區離線可用」的產品，這是核心破口。

**怎麼解決**
改成真正的 offline-first 順序：**打任何 API 之前就先把錄音寫進 IndexedDB**，成功
建立報價後才移除。順帶把邊界情況講清楚 —— 檔案過大在最前面就擋下；儲存空間滿時
改走 online-only，並在失敗時顯示真實錯誤而不是謊稱已儲存；「No speech detected」
屬不可恢復，直接清掉佇列項目避免無意義重試。

**改了什麼**
- `components/voice/VoiceRecorder.tsx` — `processAudio` 改為先存後傳

---

### 3. 附件（工地照片）會被雲端資料整份覆蓋而消失

**問題**
`attachments`、`signatureDataUrl`、`ownerToken` 這三個欄位只存在本地 ——
`syncQuoteToSupabase` 不會上傳、`fromSupabaseFormat` 也還原不了。

而伺服器每次 upsert 都把 `updated_at` 設成 server now，本地保留的卻是較早的 client
時間戳，所以雲端**必定**看起來比較新 → 下次 hydrate 或開啟報價頁時整份替換 →
工地照片無聲消失。這是「存檔 → 重新整理」就會發生的日常路徑，不是邊角案例。

**怎麼解決**
新增 `mergeCloudQuote(local, cloud)`：雲端勝出時做欄位級合併，保留這三個只存在本地
的欄位（回傳新物件，不改動輸入）。套用在兩個覆蓋點。根因（假性 cloud-newer）另外
在第 11 項處理。

**改了什麼**
- `lib/storage/mergeQuote.ts` — 新增
- `lib/storage/hydrate.ts` — cloud 勝出時改用 `mergeCloudQuote`
- `lib/storage/quotes.ts` — `refreshQuoteFromCloud` 同上

---

## 🟠 High / Medium

### 4. 刪除的 fast path 會留下雲端孤兒，之後被 hydrate 復活

**問題**
`deleteQuote` 把「在 sync queue 中」當成「從未上過雲」，直接本地 purge、不打雲端
DELETE。但報價也可能是**先前已成功同步、後來某次編輯失敗**才進佇列的 —— 這時雲端
那筆還在。使用者刪掉後，下次登入 hydrate 又會把它加回來。

**怎麼解決**
`Quote` 新增 `cloudSyncedAt` 欄位，只在雲端確認收到時寫入（由 `markQuoteCloudSynced`
統一處理；`fromSupabaseFormat` 也會設，因為從雲端讀回的資料本來就存在於雲端）。
fast path 條件收緊為 `!cloudSyncedAt && pendingSync`。`duplicateQuote` 會清空該欄位，
因為新 id 雲端沒見過。

**改了什麼**
- `types/quote.ts` — `Quote` 加 `cloudSyncedAt?: string`
- `lib/storage/quotes.ts` — 新增 `markQuoteCloudSynced`；fast path 收緊
- `lib/supabase/quotes.ts` — `fromSupabaseFormat` 設定 `cloudSyncedAt`

---

### 5. 4xx 被當成可重試，浪費 5 次退避且結局誤導

**問題**
同步 / 刪除函式只回傳 success 與錯誤字串，不帶 HTTP status。403（擋掉刪除已送出
報價、ownership 不符）、409（status regression）這類**永遠不會成功**的錯誤照樣
backoff 重試 5 次才放棄 —— 刪除的情況 tombstone 會永遠留著，使用者以為刪了、雲端
分享連結卻還活著。

**怎麼解決**
回傳 `status` 與 `retryable`：只有 408、5xx 值得重試；429 要看 error code
（burst rate limit 可重試，配額用盡不可）；DELETE 收到 404 直接視為成功 ——「雲端
沒有這筆」正是刪除想要的結果，這也順帶讓從未同步的報價不會被重試到 give-up。

刪除被永久拒絕時**回滾 tombstone**：那筆報價確實還存在且仍可公開存取，繼續在本地
隱藏它等於騙使用者。`deleteQuote` 因此多回傳 `permanent: true`，UI 改為停留在頁面
並顯示原因。

**改了什麼**
- `lib/supabase/quotes-api.ts` — 新增 `CloudWriteResult` 與 `isRetryableStatus`
- `lib/storage/quotes.ts` — 兩個佇列處理永久失敗；新增 `restoreTombstonedQuote`
- `app/quote/[id]/page.tsx` — 永久失敗時不再 `router.push("/")`
- `components/quote/BulkQuoteActions.tsx` — 「已刪除」與「已還原」分開計數

---

### 6. 匿名使用者的雲端刷新在 migration 014 之後永遠拿不到資料

**問題**
`getQuoteByIdFromSupabase` 是瀏覽器用 anon key 對 `api.quotes` 的直接 SELECT，但
migration 014 讓 anon 完全沒有 SELECT policy、authenticated 只能讀自己的列。所以
未登入使用者發這個請求必定空手而回，這條路徑對 anon 是靜默失效的。

**怎麼解決**
先檢查 session，沒有就直接回 `null`，不發無謂的請求，並在註解說明公開分享走的是
`get_quote_by_slug` RPC。

**改了什麼**
- `lib/supabase/quotes.ts` — `getQuoteByIdFromSupabase` 加 session 前置檢查

---

### 7. 離線 "Mark as Sent" 之後分享出去的連結是死的

**問題**
雲端同步失敗時本地已標成 `sent`，UI 照樣讓使用者分享連結。但公開頁的 RPC 只回傳
雲端 `status IN ('sent','accepted')` 的列 —— 雲端還是 draft（或根本不存在），
**客戶打開連結會看到 Quote Not Found**。而且因為第 1 項，這個狀態原本不會自動修復。

**怎麼解決**
`QuoteShare` 依 `cloudSyncedAt` 加上「不在 sync queue 中」判斷連結是否真的會開啟，
未發布時停用複製 / 分享 / Email 並顯示琥珀色說明，且監聽 `ksq:quotes-changed`，
背景同步補上之後自動解除封鎖。`markQuoteAsSent` 也改成只在同步成功時才
`preCacheQuotePage`，避免把「Quote Not Found」的畫面快取起來。

**改了什麼**
- `components/quote/QuoteShare.tsx` — 新增發布狀態判斷與警告
- `lib/storage/quotes.ts` — `markQuoteAsSent` 條件式 pre-cache
- `app/quote/[id]/page.tsx` — send 後重讀本地狀態（才拿得到 `cloudSyncedAt`）

---

## 🟢 Low

### 8. 錄音重播非冪等，可能產生重複草稿

**問題**
`syncSingle` 每次都用 `uuidv4()` 產生新的報價 id。如果 `saveQuote` 成功但
`removePendingAudio` 失敗（儲存空間錯誤等），下次同步會再建立一筆**重複的報價**。

**怎麼解決**
報價 id 直接使用 `item.id` —— `saveQuote` 是以 id upsert，重播會覆寫同一筆。
同時讓 VoiceRecorder 的 pending audio 與報價共用同一個 id，這樣不論報價是當場建立
還是事後由佇列重播建立，都會收斂到同一個 id。

**改了什麼**
- `hooks/useOfflineStorage.ts` — `syncSingle` 改用 `item.id`
- `components/voice/VoiceRecorder.tsx` — `pendingId` 同時作為報價 id

---

### 9. 重試時上傳的是未壓縮的原始檔，且副檔名是錯的

**問題**
兩個小問題疊在一起：失敗時存進佇列的是原始 blob 而非壓縮後的 MP3，重試會吃掉約
10 倍的行動網路流量；而 `syncSingle` 上傳時一律寫死 `recording.webm`，但 Whisper
是**靠副檔名判斷格式**的 —— 重播壓縮過的 MP3 時檔名根本對不上。

**怎麼解決**
新增 `replacePendingAudioBlob`：因為佇列副本是在壓縮**之前**就寫入的（刻意如此，
壓縮失敗不能丟資料），所以在失敗路徑上、確認壓縮成功且確實比較小時，把 MP3 換進去。
另外抽出 `audioExtension()` 給三個呼叫點共用（上傳、重播、下載）。

**改了什麼**
- `lib/storage/pending.ts` — 新增 `replacePendingAudioBlob`、`audioExtension`
- `components/voice/VoiceRecorder.tsx` — 失敗路徑換入壓縮版
- `hooks/useOfflineStorage.ts` — 上傳與下載改用 `audioExtension`

---

### 10. 登出沒有清除 Service Worker 快取

**問題**
`clearAllLocalData` 清了 IndexedDB 和 localStorage，但 `networkFirst` 早已把上一位
使用者的頁面 HTML 存進 `DYNAMIC_CACHE`。共用裝置離線時可能看到前一位使用者的頁面外殼。

**怎麼解決**
一併刪除 `ksq-dynamic-*` 快取。**刻意保留 shell cache** —— 它只裝 `/offline` 和
manifest，而 `install()` 要到下次部署才會再跑，刪掉會讓離線 fallback 直接消失。

**改了什麼**
- `lib/storage/cleanup.ts` — 清除 dynamic cache

---

### 11. 伺服器覆寫 `updated_at`，造成假性「雲端較新」

**問題**
伺服器每次 upsert 都寫自己的 `updated_at`，但客戶端本地留著 client 產生的時間戳，
所以本地副本**永遠看起來比雲端舊**，每次 hydrate 都判定雲端勝出。這是第 3 項
（附件消失）的根因。

**怎麼解決**
POST 回傳 DB 實際的 `updated_at`，客戶端在 `markQuoteCloudSynced` 中採用。加上
`syncedUpdatedAt` 守衛：如果使用者在請求飛行中又編輯了，本地確實較新，就不套用
伺服器時間戳。

**改了什麼**
- `app/api/quotes/route.ts` — upsert `.select()` 帶回 `updated_at` 並回傳 `updatedAt`
- `lib/supabase/quotes-api.ts` — `CloudWriteResult` 新增 `updatedAt`
- `lib/storage/quotes.ts` — `markQuoteCloudSynced` 改為 options 物件並採用時間戳

---

### 12. 手動建立的報價不計入月配額 ⚠️ 行為變更

**問題**
`quotes_created` 只由 `/api/transcribe` 遞增，`/api/quotes` 只檢查不遞增。所以**打字
建立的報價完全不計配額** —— 而付費方案賣的就是「每月幾張報價」。

**怎麼解決**
不能兩邊都加（語音流程會被重複計算），所以把**唯一計數點移到 `/api/quotes` POST
建立新列時**。每筆報價不論怎麼產生都必定經過這裡恰好一次，因此語音和手動都計、
都不重複。transcribe 保留原本的 pre-check（讓使用者在花掉 Groq 費用前就收到明確
錯誤），daily / global / anon 各層上限都沒動，Groq 成本仍受 free tier 每天 3 次限制。

配套修掉一個新暴露的問題：配額用盡回的是 429，但 429 原本被歸類為可重試
（rate limit），超額的報價會在佇列裡一路重試到放棄。現在 `isRetryableStatus` 會看
error code，`quota_exceeded` / `daily_quota_exceeded` 視為永久失敗，該筆留在本地並由
`QuoteShare` 顯示「尚未上傳」—— 與第 7 項的行為一致。

> **若當初「手動報價不計配額」是刻意設計**，還原只需回退
> `app/api/transcribe/route.ts` 與 `app/api/quotes/route.ts` 的遞增呼叫，
> 其餘 11 項不受影響。

**改了什麼**
- `app/api/transcribe/route.ts` — 移除 `checkAndIncrementUsage`
- `app/api/quotes/route.ts` — 建立新列成功後遞增
- `lib/supabase/quotes-api.ts` — 429 依 error code 區分是否可重試

---

## 未處理

- `components/quote/SignaturePad.tsx` 是死程式碼（沒有任何地方使用）。
  `signatureDataUrl` 欄位已被 `mergeCloudQuote` 保護，但實際上目前不會被寫入。
- 匿名報價在 bind 之後不會補計配額（維持原行為）。
- `lint` 有 6 個既有 error（`app/page.tsx`、`hooks/useAudioRecorder.ts`、
  `components/quote/ItemTemplates.tsx`、`app/q/[slug]/page.tsx`），與本輪無關。
