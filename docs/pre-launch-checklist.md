# 上線前檢查清單 (Pre-Launch Checklist)

> Project: KiwiSpeakQuote (KSQ) — NZ Voice-to-Quote
> 用法：每次正式上線（或重大發版）前，從上到下逐項勾選。出現 ❌ 一律 block 上線。

---

## 0. 上線前 24 小時凍結

- [ ] main branch 已凍結，僅允許 hotfix
- [ ] 已通知所有 contributor 凍結時間
- [ ] 回滾方案已確認（Vercel previous deployment 一鍵 revert）
- [ ] On-call 人員已排定，聯絡方式明確

---

## 1. 程式碼品質

- [ ] `npm run lint` 全綠
- [ ] `npx tsc --noEmit` 全綠（無 type error）
- [ ] `npm run build` 在乾淨環境成功（刪 `.next/` 重 build）
- [ ] 所有 `console.log` / `console.debug` 已移除（保留 `console.warn`/`error`）
- [ ] 沒有 `TODO` / `FIXME` 標記在 critical path
- [ ] 沒有 `any` 在 public API（`unknown` + narrow 才合格）

---

## 2. 測試

- [ ] 單元測試覆蓋率 ≥ 80%（`npm run test -- --coverage`）
- [ ] API 路由測試全綠（`app/api/**/__tests__`）
- [ ] 手動 E2E 走過（至少在 iPhone Safari + Android Chrome）：
  - [ ] 匿名錄音 → 轉錄 → 產生 quote → 分享連結
  - [ ] 註冊 / 登入 / 忘記密碼
  - [ ] 登入後認領 anon quote（同機 + 跨機）
  - [ ] Pro 訂閱 checkout → webhook → 配額提升
  - [ ] 取消訂閱 → 期末降級
  - [ ] 離線錄音 → 上線後 sync
  - [ ] PDF 下載
  - [ ] 編輯已寄出的 quote

---

## 3. 環境變數（Production）

每一項都要在 Vercel Production env 內檢查，**不可** 用 Preview 的值：

- [ ] `OPENAI_API_KEY` — production key（非 dev）
- [ ] `GROQ_API_KEY` — production key
- [ ] `NEXT_PUBLIC_SUPABASE_URL` — production project
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — **僅** server-side，不可 leak
- [ ] `STRIPE_SECRET_KEY` — `sk_live_...`（**不是** `sk_test_`）
- [ ] `STRIPE_WEBHOOK_SECRET` — production endpoint 的 secret
- [ ] `STRIPE_PRICE_PRO_MONTHLY` / `_YEARLY` / `TEAM_*` — live mode price IDs
- [ ] `NEXT_PUBLIC_APP_URL` — 正式 domain（非 vercel.app preview）
- [ ] 無 `.env.local` 被 commit（`git ls-files | grep .env` 應為空）

---

## 4. 資料庫（Supabase）

- [ ] 所有 migration 已 apply 到 production（`supabase db push --project-ref <prod>`）
- [ ] RLS policy 全部開啟（`SELECT tablename FROM pg_tables WHERE rowsecurity = false` 為空）
- [ ] `quotes` / `pending_audio` / `subscriptions` 表都有 RLS
- [ ] `cleanup_*` RPC 權限正確（僅 `service_role` 可呼叫）
- [ ] Cleanup cron 已設定（pg_cron 或外部 scheduler）：
  - [ ] anon quotes 過期清理
  - [ ] orphan audio blobs 清理
- [ ] Database backup 已啟用（Supabase Pro plan）
- [ ] 連線數上限確認（free tier = 60，留 buffer）

---

## 5. 安全（Security）

- [ ] 無 hardcoded secret（`git grep -E "sk_live|sk_test|sk-proj"` 應為空）
- [ ] 所有 API route 對 `userId` / `quoteId` 做 ownership 檢查
- [ ] `/api/quotes/bind` 有 rate limit + per-call cap（已修，再驗一次）
- [ ] `/api/transcribe` `/api/extract` 有 cost guard（每用戶每日上限）
- [ ] CORS 設定僅允許 production domain
- [ ] CSP header 已設（至少 `default-src 'self'`）
- [ ] Webhook endpoint 驗簽（Stripe `constructEvent` 必用）
- [ ] 無 `dangerouslySetInnerHTML` 直接吃 user input
- [ ] PDF 產生不會洩漏其他 user 的 quote（cross-tenant 測過）
- [ ] 跑過 `npm audit` — 無 high/critical 未修

---

## 6. 第三方服務

### Stripe
- [ ] Live mode 已啟用、商業驗證已通過
- [ ] Products + Prices 已在 live 建立並對到 env
- [ ] Webhook endpoint 指向 production URL，事件含：
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- [ ] Customer Portal 已 enable（cancel / update payment）
- [ ] Tax 設定（NZ GST 15%）已套用到 Prices
- [ ] SDK `apiVersion` 與 Dashboard 兼容性已驗
- [ ] 退款流程走過一次

### Groq / OpenAI
- [ ] Production org 有足夠 credit / 自動儲值
- [ ] Rate limit 確認（防爆量被鎖）
- [ ] Usage alert 已設（80% / 100% email）

### Supabase Auth
- [ ] Email template 已客製（中英對照、品牌）
- [ ] OAuth provider redirect URL 含 production domain
- [ ] Magic link / password reset 流程實測

---

## 7. 監控 & 觀測

- [ ] Error tracking 上線（Sentry / Logtail / 等同）
- [ ] Vercel Analytics / Speed Insights 啟用
- [ ] 關鍵 API 的 P95 latency 監控（transcribe、extract、quotes）
- [ ] Webhook failure alert（Stripe Dashboard 內建）
- [ ] Cost alert（OpenAI、Groq 各自 dashboard）
- [ ] Uptime monitor（UptimeRobot / BetterStack 至少打 `/`）

---

## 8. 效能

- [ ] Lighthouse mobile 分數 ≥ 85（performance）
- [ ] First Contentful Paint < 2s（4G）
- [ ] Bundle size：首屏 JS < 200KB gzip
- [ ] 圖片皆用 `next/image` 或 WebP
- [ ] 無 render-blocking 的 third-party script

---

## 9. UX / 內容

- [ ] 所有文案使用 NZ 英文拼寫（Labour、Organise、Centre）
- [ ] GST 預設 15%，inclusive/exclusive 切換正確
- [ ] 日期顯示 DD/MM/YYYY
- [ ] 貨幣 NZD `$` 前綴
- [ ] 所有按鈕 ≥ 44×44px（mobile touch target）
- [ ] iPhone SE（最小常見螢幕）+ iPad + 桌機都檢視過
- [ ] 錯誤訊息對 user 友善，不洩漏 stack trace
- [ ] 404 / 500 page 已客製
- [ ] Favicon、OG image、apple-touch-icon 全齊

---

## 10. 法務 / 合規

- [ ] Privacy Policy 頁面上線且連結可達
- [ ] Terms of Service 上線
- [ ] Cookie 同意（如有 analytics）
- [ ] GDPR / NZ Privacy Act 2020 對照：
  - [ ] User 可匯出自己的資料
  - [ ] User 可刪除帳號（cascade 刪 quotes）
- [ ] Stripe checkout 顯示公司名與地址
- [ ] 退款政策明文公告

---

## 11. SEO / Marketing

- [ ] `sitemap.xml` 可訪問
- [ ] `robots.txt` 設定正確（生產允許爬，preview 拒絕）
- [ ] 所有頁面有 unique `<title>` + `<meta description>`
- [ ] OG / Twitter card meta 完整
- [ ] Google Search Console 已 verify production domain
- [ ] Plausible / GA4 安裝且不阻塞渲染

---

## 12. 上線當下

- [ ] DNS A / CNAME 指向 Vercel production
- [ ] HTTPS 憑證生效（不可有 mixed content）
- [ ] `www` ↔ apex 301 redirect 已設
- [ ] Vercel domain alias 對到正確 deployment
- [ ] 第一筆真實付款（自己刷一次，再退款）
- [ ] Webhook 收到並處理成功（看 logs）
- [ ] Sentry / 監控收到第一個 heartbeat

---

## 13. 上線後 1 小時

- [ ] 持續觀察 error rate（< 1% of requests）
- [ ] 觀察 P95 latency 無 spike
- [ ] Stripe webhook delivery 100% 成功
- [ ] OpenAI / Groq 配額正常扣費
- [ ] 無使用者回報無法登入 / 無法錄音

---

## 14. 回滾程序（Rollback）

當下列任一觸發時立即回滾：
- 5 分鐘內 error rate > 5%
- 付款流程中斷（Stripe 500 / webhook 全失敗）
- 資料毀損（任何 user 看到別人資料）
- Auth 系統無法登入

回滾步驟：
1. Vercel Dashboard → Deployments → 上一版 → "Promote to Production"
2. 若 DB migration 已執行且不相容 → 執行 down migration
3. 公告（status page / Twitter / email）
4. 寫 incident postmortem

---

## 簽核

- [ ] Tech lead 已 review：__________________ 日期：______
- [ ] 產品 owner 已 review：__________________ 日期：______
- [ ] 上線執行人：__________________ 日期：______
