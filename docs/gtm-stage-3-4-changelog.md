# GTM Pipeline — Stage 3 & 4 Changelog

## Stage 3: Landing Page

用 Stage 2 直效文案重建 `app/page.tsx`，共 7 個轉換區塊：

| 區塊 | 內容 |
|------|------|
| Hero | Headline A「60 Seconds. From Your Ute.」+ waitlist email 表單 |
| Problem | 廚房桌子晚上 9 點的痛點故事 |
| Mechanism | Tap & Speak → AI Does the Maths → Confirm & Send |
| Benefits | 5 個賣點（現場報價、搶先報價、建材價格、Kiwi 口音、Xero 同步）|
| NZ Features | GST / Kiwi 語音辨識 / 零訊號報價 |
| Social Proof | 「Built by Kiwis Who Get It」創辦人故事 |
| FAQ | 5 題異議處理手風琴 |
| Final CTA | Waitlist 表單 + 創始會員福利 |

**新增檔案：**
- `components/landing/WaitlistForm.tsx` — email 收集元件
- `app/api/waitlist/route.ts` — rate-limited API（Supabase 可選）

---

## Stage 4: Lead Magnet

評估 5 個概念，勝出者：**Quote Time Calculator**（27/30）

| 概念 | 分數 |
|------|------|
| Quote Time Calculator | **27** |
| 3 Free Voice Quotes | 28（但等同現有 free tier，無獨立轉換時刻）|
| Health Check Quiz | 23 |
| Trade Rates Benchmark | 23 |
| Quote Template Pack | 22 |

**Calculator 流程：** 選擇工種 → 每週報價數 → 每份耗時 → 平均工單金額 → Email gate → 結果頁（before/after 對比 + 分享按鈕）

**新增檔案：**
- `components/landing/QuoteCalculator.tsx` — 4 步互動計算器
- `app/tools/quote-calculator/page.tsx` — 獨立頁面（廣告導流用）
- `docs/lead-magnet-analysis.md` — 完整分析文件
