# Quote CRUD Review — 問題與修復

本文記錄這輪 Code Review 修掉的所有問題。每條以「白話問題 → 怎麼解決 → 改了什麼」的格式呈現。

相關 commits（分支 `claude/review-quote-crud-LCsuC`）：
- `d11ca67` 移除 `unlockQuoteForEditing` 後門
- `f9788c0` tombstone 刪除 + `updateQuote` 暴露同步錯誤
- `2606f36` 伺服器驗證強化 + retry backoff + local-first slug
- `9e8119f` 防雲端覆蓋 + tombstone-safe 寫入 + 長度上限
- `4ff9930` 補齊測試 coverage

---

## 🔴 高優先

### 1. `unlockQuoteForEditing` 後門繞過版本控管

**問題**
有一個「解鎖」函式可以把已送出（`sent`）的報價強制改回 `draft`，使用者可以直接編輯原本那張，不會留下新版本紀錄。這等於繞過 `parentId`/`version` 的 audit chain —— 客戶手上那份 V1 跟你手機上那份 V1 內容不一樣，爭議時無從追。

**怎麼解決**
整個函式砍掉。`EditSentQuoteDialog` 只剩「建立新版本 V2」一個選項（付費功能）；免費用戶超過版本上限時，顯示升級 Pro 的 CTA，不再偷偷讓他們覆蓋原稿。

**改了什麼**
- `lib/storage/quotes.ts` — 刪除 `unlockQuoteForEditing`
- `components/quote/EditSentQuoteDialog.tsx` — 移除 `onEditOriginal` prop
- `app/quote/[id]/page.tsx` — 移除 `handleEditOriginal` callback

---

### 2. `updateQuote` 回傳 key 名稱寫錯，呼叫端永遠收不到同步錯誤

**問題**
函式宣告的回傳型別是 `{ error?: string }`，但實作裡把雲端失敗訊息放進 `syncError`，UI 永遠拿不到 `error`，雲端同步失敗會**靜默**。使用者以為存好了，實際只在自己手機上。

**怎麼解決**
把回傳型別拆開成 `error`（硬失敗，要 abort）跟 `syncError`（軟失敗，已存本地、待重試）。UI 分開處理兩種狀況。

**改了什麼**
- `lib/storage/quotes.ts` — `updateQuote` 回傳 `{ synced, error?, syncError? }`
- `app/quote/[id]/page.tsx` — `handleSave` 檢查 `syncError` 顯示 warning toast

---

### 3. 本地刪除先於雲端確認 —— 資料遺失風險

**問題**
`deleteQuote` 先把本地那筆 purge，再去打雲端 API。如果雲端刪除失敗（網路、403…），本地已經沒了；使用者以為刪掉但雲端還在，重新整理又會從雲端同步回來，或更糟：永遠遺失。

**怎麼解決**
改成 **tombstone 模式**：
1. 先在本地 row 上蓋 `deletedAt` 時間戳（UI 列表就看不到它了）。
2. 打雲端刪除 API。
3. 雲端成功 → 才真正 purge 本地。雲端失敗 → 保留 tombstone、丟進 `ksq_delete_queue`、之後重試。

另外加了 **fast path**：如果報價從沒上傳過雲端（還在 sync queue），直接 purge 本地，不打雲端。

**改了什麼**
- `types/quote.ts` — `Quote` 加 `deletedAt?: string`
- `lib/storage/quotes.ts` — `deleteQuote` 改 tombstone；新增 `syncPendingDeletions`、`getDeleteQueue`
- `getAllQuotes`/`getQuoteById`/`refreshQuoteFromCloud`/`generateSlug` 過濾或尊重 tombstone

---

## 🟡 中優先

### 4. 客戶看到的金額可能被竄改

**問題**
前端送 `item.total` 跟 `items_sum` 給後端，後端直接存。資料庫的 `subtotal`/`gst`/`total` 是 `GENERATED ALWAYS` 從 `items_sum` 算出來，所以有人改了前端 payload，騙過的金額會直接出現在客戶的報價單上。

**怎麼解決**
API 後端**重算**每個 item 的 `total = quantity × unitPrice`，再加總出 `items_sum`。client 給的數字完全不信。順便驗證 `quantity`/`unitPrice` 必須是非負有限數字。

**改了什麼**
- `app/api/quotes/route.ts` — POST handler 加上 sanitize 迴圈 + items_sum 重算

---

### 5. 兩人同時寫同一筆報價，後寫的擁有權會被偷走

**問題**
Server 先 `SELECT` 查 owner，再 `UPSERT`。這中間如果別人剛好也在寫同一個 id，我們的 SELECT 看到空、放行、UPSERT 進去，但這筆 row 已經被別人的 token 佔走了。

**怎麼解決**
UPSERT 時 `.select("id, owner_token_hash")` 把結果撈回來，再比對一次 hash。不符就回 **409**，叫 client 重試。

**改了什麼**
- `app/api/quotes/route.ts` — 加上 post-upsert ownership 驗證

---

### 6. 雲端同步失敗，使用者完全不知道

**問題**
存 local 成功、雲端失敗時，UI 只 toast「Quote saved!」。使用者以為存好了，其實只在這支手機上，離線/換機就遺失。

**怎麼解決**
- `saveQuote` / `markQuoteAsSent` 改回傳 `{ synced, syncError }`。
- UI 收到 `!synced` 時顯示 warning：**「Saved locally, but cloud sync failed. Will retry automatically.」**

**改了什麼**
- `lib/storage/quotes.ts` — 三個函式的回傳值
- `app/quote/[id]/page.tsx` — `handleSend` 分支處理
- `hooks/useQuotes.ts` — `save` 把結果往外傳

---

### 7. 網路一直壞時，會無腦重試爆打 server

**問題**
同步失敗就丟進 queue，每次 app 啟動或上線就再打一次。如果是 permanent 錯誤（例如 403 權限）會永遠卡住，空耗電、空耗流量、空打 Supabase。

**怎麼解決**
加一個「失敗記錄本」(`ksq_sync_failures` / `ksq_delete_failures`)，每個 ID 記 `{ attempts, lastAttemptAt }`：
- **指數退避**：失敗 1 次 → 等 10 秒；2 次 → 20 秒；3 次 → 40 秒；4 次 → 80 秒
- **上限 5 次放棄**：
  - Sync 的話從 queue 拿掉（使用者再存一次就重新排）
  - Delete 的話強制把 local tombstone 清掉（留孤兒在雲端，但本地不卡）

**改了什麼**
- `lib/storage/quotes.ts` — 新增 `RetryState`、`recordRetryFailure`、`isBackoffActive`；`syncPendingQuotes`/`syncPendingDeletions` 檢查 backoff + 上限

---

### 8. 打開自己的報價要等雲端回應（離線壞掉）

**問題**
`getQuoteBySlug` 之前**先打 Supabase**。訊號差或離線時，自己的報價都要 loading，違反 offline-first 原則。

**怎麼解決**
改成 **local-first**：先查 IndexedDB，找不到才去雲端。自己的報價秒開；公開分享連結（別人的裝置）還是能從雲端拿。

**改了什麼**
- `lib/storage/quotes.ts` — `getQuoteBySlug` 重新排序

---

## 🟢 低優先

### 9. `refreshQuoteFromCloud` 會蓋掉本地未同步的編輯（資料遺失）

**問題**
使用者離線編輯 → 變更在 sync queue 排隊 → 打開該報價頁 → 背景 `refreshQuoteFromCloud` 從雲端抓到**舊版**，直接寫回 IndexedDB。使用者剛剛改的東西就被靜默蓋掉了。

**怎麼解決**
Refresh 時三個保險：
1. 如果本地是 tombstoned → 不覆蓋（pending delete）
2. 如果 id 還在 sync queue → 不覆蓋（pending upload）
3. 如果本地 `updatedAt` 比雲端新 → 不覆蓋

**改了什麼**
- `lib/storage/quotes.ts` — `refreshQuoteFromCloud` 加上三段檢查

---

### 10. `markQuoteAsSent` 寫回時會砍掉所有 tombstone

**問題**
這是我第 3 項 tombstone 改動自己引入的 regression：函式讀取用 `getAllQuotes()`（已過濾 tombstone），但又用這個過濾過的 list 寫回 IndexedDB。結果：使用者按一下「Mark as Sent」，**所有**還在等雲端確認刪除的 tombstone 全部消失。

**怎麼解決**
改用 `getAllQuotesRaw()` 讀原始 list，寫回時所有 tombstone 都保留。`saveQuote`/`updateQuote` 同步改過。

**改了什麼**
- `lib/storage/quotes.ts` — 三個寫入函式都改用 raw store

---

### 11. `saveQuote` 在 tombstone 上會建立 id 重複的 row

**問題**
如果某 id 已 tombstoned，`getAllQuotes()` 過濾掉它，`findIndex` 回 -1，程式就把新資料 append 成第二筆同 id 的 row。後果：`generateSlug` 會看到兩個、sync 機制會混亂。

**怎麼解決**
改用 raw store 找 index；遇到 tombstoned 就地「復活」（清掉 `deletedAt`、移出 `delete queue`、清掉 delete 重試紀錄）。這也支援一個合理 UX：使用者刪除後馬上後悔重新編輯，會自動救回。

**改了什麼**
- `lib/storage/quotes.ts` — `saveQuote` tombstone 復活邏輯
- `updateQuote`/`markQuoteAsSent` 明確拒絕更新 tombstoned

---

### 12. API 沒有字串長度上限

**問題**
`customerName`、`notes`、`items` 數量… 都沒有上限。broken 或 malicious client 可以送 100MB 字串進 DB，或灌爆 log、或拉慢整台 server。

**怎麼解決**
API 加保守上限並在超過時回 400：

| 欄位 | 上限 |
|---|---|
| `customerName` | 200 |
| `customerEmail` | 320 (RFC 5321) |
| `customerPhone` | 40 |
| `customerAddress` | 500 |
| `notes` | 5000 |
| `items[].description` | 1000 |
| `items` 數量 | 100 |

**改了什麼**
- `app/api/quotes/route.ts` — 新增長度檢查常數 + loop

---

### 13. `duplicateQuote` 把舊簽名帶到新版本

**問題**
V2 新建時，整個 quote 物件 spread 過去，包括 V1 的 `signatureDataUrl`（客戶在 V1 上簽的）。但 V2 是新的 draft，那個簽名是屬於 V1 那張已送出的報價的。此外，`duplicateQuote` 內部呼叫 `saveQuote` 時，sync 失敗會被靜默吞掉。

**怎麼解決**
建立新 quote 時明確把 `signatureDataUrl` 和 `deletedAt` 設為 `undefined`。內部 save 失敗加上 `console.warn` 讓至少 log 看得到。

**改了什麼**
- `lib/storage/quotes.ts` — `duplicateQuote` 清掉 per-send artefacts + log soft failure

---

## 測試覆蓋率

總共 **247 個測試全過**，新增的測試涵蓋上述每個修改點：

- **Tombstone 行為**：delete queue、purge、refresh skip、mark-as-sent preserve、revival（11 個）
- **Sync error / retry**：backoff、skip、give up、counter increment、clear on success（9 個）
- **Ownership race**：403 (token mismatch) + 409 (post-upsert race)（2 個）
- **長度上限**：customerName、notes、items 數、item description（4 個）
- **負數 / 非數字驗證**：quantity < 0、unitPrice 非數字（2 個）
- **Server 重算**：送 tampered total，驗證 DB 寫入正確金額（1 個）
- **refreshQuoteFromCloud 安全**：pending sync、local newer、cloud newer、tombstoned（4 個）
- **getQuoteBySlug local-first**：local hit、cloud fallback、missing、tombstoned（4 個）
- **duplicate signature reset**：新版本不帶舊簽名（1 個）

## 驗證指令

```bash
npx vitest run           # 247 passed
npx tsc --noEmit         # clean
npm run lint             # 無新 warning（只剩一個原本就有的 _createdAt）
```
