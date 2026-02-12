# KiwiSpeakQuote — AI-Driven Tradies CRM/ERP 系統規劃

> **版本:** v1.0 | **日期:** 12/02/2026
> **定位:** 以 Voice Quote 為前台獲客引擎，AI-Driven CRM/ERP 為後台自動化管理核心

---

## 目錄

1. [商業策略總覽](#1-商業策略總覽)
2. [產品架構全景圖](#2-產品架構全景圖)
3. [前台獲客引擎：Voice Quote + 更多策略](#3-前台獲客引擎)
4. [後台 CRM/ERP 功能模組規劃](#4-後台-crmerp-功能模組規劃)
5. [AI 自動化引擎詳細設計](#5-ai-自動化引擎詳細設計)
6. [資料庫 Schema 擴展規劃](#6-資料庫-schema-擴展規劃)
7. [技術架構與基礎設施](#7-技術架構與基礎設施)
8. [分階段實施路線圖](#8-分階段實施路線圖)
9. [商業模式與定價策略](#9-商業模式與定價策略)
10. [關鍵指標 (KPIs)](#10-關鍵指標-kpis)
11. [風險與緩解策略](#11-風險與緩解策略)

---

## 1. 商業策略總覽

### 1.1 核心洞察

NZ 的 Tradies（水電工、電工、園藝師、建築工等）有以下痛點：

| 痛點 | 現狀 | 我們的解法 |
|------|------|-----------|
| 報價太慢 | 手動打字、回辦公室才處理 | **Voice Quote**：語音秒出報價 |
| 客戶管理混亂 | 電話簿 + 紙本 + 記憶 | **AI CRM**：自動建立客戶檔案 |
| 忘記跟進 | 報價後忘記追蹤 | **AI Follow-up**：自動提醒與追蹤 |
| 財務不清楚 | Excel / 不記帳 | **自動 Invoice + 收款追蹤** |
| 排程混亂 | 紙本日曆 / 腦袋記 | **AI 排程 + 日曆同步** |
| 不知道賺不賺錢 | 沒有數據 | **AI 利潤分析 Dashboard** |

### 1.2 Product-Led Growth (PLG) 飛輪

```
                    ┌─────────────────────┐
                    │   免費 Voice Quote   │ ← 入口（零門檻）
                    │   （前台獲客引擎）    │
                    └─────────┬───────────┘
                              │ 使用後自動建立帳戶
                              ▼
                    ┌─────────────────────┐
                    │   免費 CRM 基礎功能  │ ← 黏著（習慣養成）
                    │   客戶清單 + 報價歷史 │
                    └─────────┬───────────┘
                              │ 數據累積 → 看到價值
                              ▼
                    ┌─────────────────────┐
                    │   Pro CRM/ERP 功能   │ ← 轉化（付費訂閱）
                    │   AI 自動化 + 分析   │
                    └─────────┬───────────┘
                              │ 口碑推薦
                              ▼
                    ┌─────────────────────┐
                    │   Tradies 互相推薦   │ ← 擴散（網絡效應）
                    │   Trade Network     │
                    └─────────────────────┘
```

### 1.3 競爭優勢

1. **Voice-First**：市場上沒有其他 NZ Tradies 工具用語音作為核心入口
2. **NZ 本土化**：GST 15%、NZ 拼寫、Kiwi 俚語、NZ 銀行帳號格式
3. **AI 原生**：不是在舊系統上加 AI，而是 AI-First 設計
4. **Offline-First**：Canterbury 偏遠地區也能用
5. **一手操作**：專為工地現場設計的 UX

---

## 2. 產品架構全景圖

```
┌─────────────────────────────────────────────────────────────────────┐
│                        KiwiSpeakQuote 產品架構                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────── 前台（獲客層）────────────────┐                   │
│  │                                               │                   │
│  │  🎤 Voice Quote Engine (現有)                 │                   │
│  │  📱 Public Quote Page (現有)                  │                   │
│  │  🌐 Landing Page + SEO (現有 + 強化)          │                   │
│  │  📣 Referral System (新)                      │                   │
│  │  🛒 Trade Marketplace (Phase 4)               │                   │
│  │                                               │                   │
│  └───────────────────┬───────────────────────────┘                   │
│                      │ 自動轉化                                      │
│  ┌───────────────────▼───────────────────────────┐                   │
│  │                                               │                   │
│  │              後台（CRM/ERP 層）                │                   │
│  │                                               │                   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐         │                   │
│  │  │ 客戶管理 │ │ 報價管線 │ │ Job管理  │         │                   │
│  │  │   CRM   │ │Pipeline │ │  Mgmt   │         │                   │
│  │  └─────────┘ └─────────┘ └─────────┘         │                   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐         │                   │
│  │  │  帳務   │ │  排程   │ │  通訊   │          │                   │
│  │  │ Invoice │ │Calendar │ │Comms Hub│          │                   │
│  │  └─────────┘ └─────────┘ └─────────┘         │                   │
│  │  ┌─────────┐ ┌─────────┐                     │                   │
│  │  │ AI 分析  │ │ 團隊管理 │                     │                   │
│  │  │Analytics│ │  Team   │                      │                   │
│  │  └─────────┘ └─────────┘                     │                   │
│  │                                               │                   │
│  └───────────────────┬───────────────────────────┘                   │
│                      │                                               │
│  ┌───────────────────▼───────────────────────────┐                   │
│  │              AI 自動化引擎                     │                   │
│  │                                               │                   │
│  │  🤖 Auto Follow-up    📊 Smart Pricing        │                   │
│  │  🔔 Smart Reminders   📈 Profit Analysis      │                   │
│  │  💬 AI Draft Comms    🔮 Churn Prediction     │                   │
│  │  📋 Auto Categorise   ⚡ Workflow Triggers     │                   │
│  │                                               │                   │
│  └───────────────────────────────────────────────┘                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. 前台獲客引擎

### 3.1 現有 Voice Quote（強化方向）

**現狀：** 語音錄製 → 轉錄 → AI 萃取 → 報價單

**強化計劃：**

| 功能 | 說明 | 優先級 |
|------|------|--------|
| 多語言支援 | 支援 Te Reo Māori 常用詞彙 | P1 |
| Smart Templates | AI 根據行業自動套用模板（水電 vs 園藝） | P1 |
| Voice-to-Invoice | 不只報價，直接語音出帳單 | P2 |
| 照片附件 | 語音 + 拍照，AI 辨識材料/問題 | P2 |
| 重複客戶自動匹配 | 說 "John 的那個案子" AI 自動找到客戶 | P2 |

### 3.2 其他獲客策略建議

#### A. Tradie Referral Programme（推薦計劃）
- 每推薦一個付費用戶，免費延長 1 個月 Pro
- "Mate Rate" 折扣碼系統
- NZ Tradies 高度社群化，口碑效果好

#### B. SEO + Content Marketing
- 建立 Blog：「How to Quote for [Plumbing/Electrical/etc] Jobs in NZ」
- 工具頁面：免費 GST 計算器、NZ Trade License 查詢
- 地區 Landing Pages：「Best Quoting App for Canterbury Tradies」

#### C. Trade Show + Facebook Groups
- NZ 各地 Trade Show 贊助/展位
- Facebook Groups「NZ Tradies」「Canterbury Builders」等社群行銷
- 真人 Tradie 影片見證（Kiwi 風格，不要太商業）

#### D. Partnerships
- 與 NZ 建材供應商（Bunnings, Placemakers）合作
- 與 Trade Me Jobs / Builderscrack 整合
- 與會計軟體（Xero, MYOB）整合

#### E. Freemium 入口策略
```
免費版：每月 10 張 Voice Quote + 基礎客戶清單
Pro 版：無限 Quote + 全 CRM + AI 自動化 + 分析報表
Team 版：多人 + 排程 + 團隊管理
```

---

## 4. 後台 CRM/ERP 功能模組規劃

### 4.1 模組 A：客戶管理 (Customer CRM)

**核心概念：** 從每張報價自動建立客戶檔案，零手動輸入

#### 功能清單

| 功能 | 說明 | AI 自動化 |
|------|------|----------|
| 自動客戶建立 | 新報價 → 自動比對或建立客戶 | ✅ AI 姓名/電話模糊比對 |
| 客戶 360 View | 所有報價、Job、Invoice、通訊歷史 | ✅ AI 摘要 |
| 客戶標籤 | 行業類型、區域、VIP、需跟進 | ✅ AI 自動標籤 |
| 客戶評分 | 付款速度、Job 規模、回頭率 | ✅ AI 計算 |
| 重複客戶合併 | 同一人不同資料自動偵測 | ✅ AI 建議合併 |
| 客戶備註 | 語音備註 → 文字備註 | ✅ 語音轉文字 |
| 客戶通訊錄 | 手機、Email、地址、公司 | 手動 + AI 自動填入 |

#### 客戶自動匹配邏輯
```
新報價進入 → AI 比對引擎
  ├─ 完全匹配（電話/Email）→ 連結到現有客戶
  ├─ 模糊匹配（姓名相似 + 地址相近）→ 建議合併
  └─ 無匹配 → 建立新客戶
```

### 4.2 模組 B：報價管線 (Quote Pipeline)

**核心概念：** 報價不只是文件，是一個有生命週期的銷售機會

#### Pipeline 看板

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│  Draft   │ → │   Sent   │ → │ Followed │ → │ Accepted │ → │   Job    │
│  草稿    │   │  已發送   │   │  已跟進   │   │  已接受   │   │  進入Job │
│          │   │          │   │          │   │          │   │          │
│  12 筆   │   │   8 筆   │   │   5 筆   │   │   3 筆   │   │   2 筆   │
│ $45,000  │   │ $32,000  │   │ $22,000  │   │ $15,000  │   │ $12,000  │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
```

#### 功能清單

| 功能 | 說明 | AI 自動化 |
|------|------|----------|
| Kanban 看板 | 拖拉式管線管理 | — |
| 自動狀態流轉 | 發送後自動移到 "Sent" | ✅ |
| 跟進提醒 | 發送 3 天未回覆 → 提醒 | ✅ AI 決定時機 |
| AI 跟進訊息 | 自動草擬跟進 SMS/Email | ✅ AI 撰寫 |
| Win/Loss 分析 | 為什麼這張報價沒成？ | ✅ AI 分析模式 |
| 報價模板 | 常用報價一鍵套用 | ✅ AI 建議模板 |
| 報價比較 | 同客戶不同版本比較 | — |
| 有效期提醒 | 報價到期前自動通知 | ✅ |

### 4.3 模組 C：Job 管理 (Job Management)

**核心概念：** 報價接受 → 自動建立 Job → 追蹤到完工

#### Job 狀態流

```
Accepted Quote → Job Created → Scheduled → In Progress → Completed → Invoiced → Paid
       │              │            │            │             │           │         │
       ▼              ▼            ▼            ▼             ▼           ▼         ▼
  AI 建立 Job    排入日曆    發提醒給客戶   追蹤時數/材料   產生 Invoice  發帳單   標記完成
```

#### 功能清單

| 功能 | 說明 | AI 自動化 |
|------|------|----------|
| 自動 Job 建立 | 報價接受 → 自動建立 Job | ✅ |
| Job 追蹤 | 狀態、時間、材料、成本 | — |
| 材料清單 | 從報價自動產生材料清單 | ✅ AI 萃取 |
| 時間追蹤 | 開工/收工打卡（語音或按鈕） | — |
| 實際 vs 預估 | 實際成本 vs 報價成本比較 | ✅ AI 分析 |
| Job Notes | 語音備註（現場用） | ✅ 語音轉文字 |
| 照片記錄 | Before/After 照片 | — |
| 完工報告 | AI 自動產生完工摘要 | ✅ |

### 4.4 模組 D：帳務管理 (Invoice & Payment)

**核心概念：** Job 完成 → 一鍵出帳單 → 自動追款

#### 功能清單

| 功能 | 說明 | AI 自動化 |
|------|------|----------|
| 自動出帳單 | Job 完成 → AI 產生 Invoice | ✅ |
| NZ GST 報表 | 自動計算 GST 回報 | ✅ |
| 付款追蹤 | 標記已付/未付/部分付款 | — |
| 逾期提醒 | 7/14/30 天自動發提醒 | ✅ AI 撰寫 + 自動發送 |
| 付款方式 | Bank Transfer / Stripe / POLi | — |
| Xero 整合 | 同步 Invoice 到 Xero | ✅ API 同步 |
| 收款確認 | 銀行對帳或手動確認 | 半自動 |
| 壞帳標記 | 超過 90 天未收 → 標記 | ✅ AI 建議 |

#### Invoice 模板
```
┌─────────────────────────────────────┐
│  KSQ Invoice #INV-2026-0042        │
│  ─────────────────────────────────  │
│  From: Mike's Plumbing Ltd          │
│  To:   John Smith                   │
│  Date: 12/02/2026                   │
│  Due:  26/02/2026 (14 days)         │
│  ─────────────────────────────────  │
│  Item          Qty   Rate    Total  │
│  Hot water install  1  $850  $850   │
│  Labour (3hrs)      3  $95   $285   │
│  Parts & fittings   1  $220  $220   │
│  ─────────────────────────────────  │
│  Subtotal                  $1,355   │
│  GST (15%)                   $203   │
│  TOTAL (incl. GST)        $1,558   │
│  ─────────────────────────────────  │
│  Bank: 06-0123-0456789-00          │
│  Ref:  INV-2026-0042               │
└─────────────────────────────────────┘
```

### 4.5 模組 E：智慧排程 (Smart Scheduling)

**核心概念：** AI 根據 Job 類型、地點、時長自動建議最佳排程

#### 功能清單

| 功能 | 說明 | AI 自動化 |
|------|------|----------|
| 日曆視圖 | 日/週/月 Job 排程 | — |
| 智慧排程 | AI 根據距離、時長、優先級排程 | ✅ |
| 客戶通知 | 排程確認後自動通知客戶 | ✅ |
| 衝突檢測 | 自動偵測排程衝突 | ✅ |
| 路線優化 | 同區域 Job 自動排在一起 | ✅ |
| Google Calendar 同步 | 雙向同步 | ✅ API |
| 取消/改期 | 客戶取消 → AI 自動遞補 | ✅ |
| 天氣整合 | 戶外 Job + 雨天 → 自動調整建議 | ✅ |

### 4.6 模組 F：通訊中樞 (Communication Hub)

**核心概念：** 所有客戶溝通在一個地方，AI 代寫大部分訊息

#### 功能清單

| 功能 | 說明 | AI 自動化 |
|------|------|----------|
| SMS 發送 | NZ 手機號碼 SMS | ✅ AI 撰寫 |
| Email 發送 | 報價/帳單/跟進 | ✅ AI 撰寫 |
| WhatsApp | 透過 WhatsApp Business API | ✅ AI 撰寫 |
| 訊息模板 | 常用訊息一鍵發送 | ✅ AI 建議 |
| 溝通歷史 | 所有訊息集中在客戶頁面 | ✅ 自動記錄 |
| AI 語氣調整 | 專業但 Kiwi 風格 | ✅ |
| 批次發送 | 群發促銷/節日問候 | ✅ |

#### AI 訊息範例
```
SMS (跟進報價):
"Hey John, just checking in on that bathroom reno quote
I sent through last week. Keen to get it sorted before
winter? Give us a bell if you've got any questions. Cheers!"

Email (Invoice 逾期):
"Hi John,
Just a friendly reminder that invoice INV-2026-0042
for $1,558.00 was due on 26/02/2026.
Would appreciate if you could sort the payment when
you get a chance. Bank details are on the invoice.
Cheers,
Mike - Mike's Plumbing Ltd"
```

### 4.7 模組 G：AI 分析 Dashboard

**核心概念：** 把數據變成行動建議，Tradies 不需要看懂報表

#### Dashboard 組件

| 組件 | 數據 | AI 洞察 |
|------|------|---------|
| 月收入 | 本月 Invoice 總額 vs 上月 | "收入比上月成長 15%" |
| 報價轉換率 | Accepted / Total Quotes | "你的轉換率 38%，高於行業平均 25%" |
| 平均 Job 價值 | 平均每 Job 金額 | "園藝 Job 利潤最高，建議多接" |
| 待收帳款 | 未付 Invoice 總額 | "有 $3,200 超過 14 天未收" |
| 客戶排名 | Top 10 客戶（by 收入） | "John Smith 是你最大客戶，上次 Job 3 個月前" |
| 忙碌預測 | 未來 2 週排程 | "下週三有空檔，建議跟進 pending quotes" |
| 利潤分析 | 預估 vs 實際成本 | "Hot water 安裝的利潤率比報價高 12%" |
| 季節趨勢 | 月度趨勢圖 | "每年 3-5 月是你的旺季" |

#### AI 每日摘要（推送通知）
```
🌅 Good morning Mike!

Today's rundown:
• 2 jobs scheduled (9am Riccarton, 2pm Hornby)
• 3 quotes awaiting response ($4,200 total)
• 1 invoice overdue (John Smith, $1,558)

Suggested actions:
→ Follow up with Sarah about the kitchen reno quote
→ Invoice Mrs Chen for yesterday's job
→ Your 2pm is near Hornby — the Robinson quote is
  nearby, might be worth a site visit?
```

### 4.8 模組 H：團隊管理 (Team Management) — Phase 3+

| 功能 | 說明 |
|------|------|
| 多用戶 | 老闆 + 員工帳號 |
| 角色權限 | Admin / Tradie / Office Admin |
| 指派 Job | 將 Job 指派給團隊成員 |
| 團隊日曆 | 查看所有人排程 |
| 時薪追蹤 | 員工工時記錄 |
| 績效報表 | 每人完成 Job 數、收入 |

---

## 5. AI 自動化引擎詳細設計

### 5.1 自動化觸發器架構

```
┌─────────────────────────────────────────────────────┐
│               AI Automation Engine                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─── Event Triggers ───┐                           │
│  │                      │                           │
│  │  • Quote Created     │──→ Auto-create Customer   │
│  │  • Quote Sent        │──→ Start Follow-up Timer  │
│  │  • Quote Accepted    │──→ Create Job + Schedule  │
│  │  • Quote Expired     │──→ Send Reminder          │
│  │  • Job Completed     │──→ Generate Invoice       │
│  │  • Invoice Sent      │──→ Start Payment Timer    │
│  │  • Invoice Overdue   │──→ Send Reminder (1/2/3)  │
│  │  • Payment Received  │──→ Mark Paid + Thank You  │
│  │  • No Activity 30d   │──→ Re-engagement Campaign │
│  │                      │                           │
│  └──────────────────────┘                           │
│                                                     │
│  ┌─── Scheduled Jobs ───┐                           │
│  │                      │                           │
│  │  • Daily Summary     │──→ Push Notification      │
│  │  • Weekly Report     │──→ Email Digest           │
│  │  • Monthly Analytics │──→ Business Review        │
│  │  • GST Period        │──→ GST Return Reminder    │
│  │                      │                           │
│  └──────────────────────┘                           │
│                                                     │
│  ┌─── AI Decisions ─────┐                           │
│  │                      │                           │
│  │  • When to follow up │  (based on quote value,   │
│  │  • What tone to use  │   customer history,       │
│  │  • Which channel     │   day of week, etc.)      │
│  │  • Pricing suggest.  │                           │
│  │                      │                           │
│  └──────────────────────┘                           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 5.2 自動化流程詳解

#### Flow 1: Quote → Customer → Follow-up

```
Voice Quote 建立
    │
    ▼
AI 比對引擎：這個客戶存在嗎？
    ├─ YES → 連結到現有客戶，更新資料
    └─ NO  → 建立新客戶檔案
    │
    ▼
用戶發送報價
    │
    ▼
AI 設定 Follow-up 計劃：
    ├─ Day 3: SMS "Just checking in..."
    ├─ Day 7: Email 正式跟進 + 微調報價
    └─ Day 14: 最後跟進 "Quote still valid until..."
    │
    ▼（每次 Follow-up 前 AI 檢查）
    ├─ 客戶已回覆？→ 取消後續
    ├─ 客戶已接受？→ 觸發 Job Creation
    └─ 未回覆 → 發送下一個 Follow-up
```

#### Flow 2: Job Lifecycle

```
報價被接受
    │
    ▼
AI 自動建立 Job
    ├─ 從報價複製所有項目
    ├─ 產生材料採購清單
    └─ 建議排程時段（根據空檔 + 客戶位置）
    │
    ▼
用戶確認/調整排程
    │
    ▼
AI 發送客戶通知
    ├─ "Your job is scheduled for [date]"
    └─ "We'll arrive between [time range]"
    │
    ▼
Job 當天
    ├─ AI 發送提醒給 Tradie（前一天晚上）
    └─ AI 發送提醒給客戶（當天早上）
    │
    ▼
用戶標記完工
    │
    ▼
AI 動作：
    ├─ 產生 Invoice（從 Job 資料）
    ├─ 計算實際 vs 預估利潤
    └─ 建議發送 "Thank you" + 要求評價
```

#### Flow 3: Invoice → Payment

```
Invoice 產生
    │
    ▼
AI 發送 Invoice（客戶偏好通道）
    ├─ Email + PDF 附件
    ├─ SMS + 連結
    └─ WhatsApp + 連結
    │
    ▼
AI 追款計劃：
    ├─ Due Date: 等待
    ├─ Due +3 天: 友善提醒 SMS
    ├─ Due +7 天: 正式 Email 提醒
    ├─ Due +14 天: 電話提醒建議（推送通知給 Tradie）
    └─ Due +30 天: 正式催款信 + 標記為逾期
    │
    ▼
收到付款
    │
    ▼
AI 動作：
    ├─ 標記為已付
    ├─ 發送 "Payment received, thank you!"
    ├─ 更新客戶評分
    └─ 更新現金流 Dashboard
```

### 5.3 AI 模型使用策略

| 功能 | 模型 | 原因 |
|------|------|------|
| 語音轉文字 | Groq Whisper (whisper-large-v3) | 速度快、NZ 口音佳 |
| 報價資料萃取 | GPT-4o-mini | 便宜、低延遲 |
| 訊息撰寫 | GPT-4o-mini | 夠好且便宜 |
| 客戶匹配 | 本地算法 + GPT-4o-mini 後備 | 先用快的，不行再用 AI |
| 日報/週報摘要 | GPT-4o-mini | 結構化輸出 |
| 複雜分析/建議 | GPT-4o | 需要更深推理時 |
| 排程優化 | 本地算法 | 不需 LLM |

### 5.4 自動化程度分級

```
Level 1 - 全自動（不需人工）:
  ✅ 客戶檔案建立
  ✅ Job 自動建立（從 accepted quote）
  ✅ Invoice 自動產生
  ✅ 提醒通知排程
  ✅ Dashboard 數據更新
  ✅ GST 計算

Level 2 - AI 草擬，一鍵確認:
  👆 Follow-up 訊息（AI 寫好，用戶按 Send）
  👆 排程建議（AI 排好，用戶確認）
  👆 Invoice 催款（AI 寫好，用戶按 Send）
  👆 客戶合併建議（AI 偵測，用戶確認）

Level 3 - AI 建議，用戶決策:
  💭 定價建議（參考歷史數據）
  💭 客戶優先級排序
  💭 業務策略建議
  💭 擴展機會分析
```

---

## 6. 資料庫 Schema 擴展規劃

### 6.1 現有 Schema（保留不動）

```sql
-- 現有：保持不動
api.quotes    -- 報價表（已有完整 GST 計算、版本控制、RLS）
api.profiles  -- 用戶檔案（已有業務資訊）
```

### 6.2 新增 Schema

```sql
-- ============================================
-- 模組 A: 客戶管理
-- ============================================

CREATE TABLE api.customers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id),  -- 屬於哪個 Tradie

  -- 基本資料
  name          TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  company       TEXT,

  -- AI 管理
  tags          TEXT[] DEFAULT '{}',        -- ['residential', 'auckland', 'vip']
  score         INTEGER DEFAULT 50,         -- 0-100 客戶評分
  source        TEXT DEFAULT 'quote',       -- 來源：quote, manual, referral

  -- 統計（定期更新）
  total_quotes  INTEGER DEFAULT 0,
  total_jobs    INTEGER DEFAULT 0,
  total_revenue NUMERIC(12,2) DEFAULT 0,
  last_activity TIMESTAMPTZ,

  -- Meta
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- 客戶去重索引
CREATE INDEX idx_customers_user_phone ON api.customers(user_id, phone);
CREATE INDEX idx_customers_user_email ON api.customers(user_id, email);
CREATE INDEX idx_customers_user_name  ON api.customers(user_id, name);

-- ============================================
-- 報價表擴展（新增欄位）
-- ============================================

ALTER TABLE api.quotes
  ADD COLUMN customer_id UUID REFERENCES api.customers(id),
  ADD COLUMN expires_at  TIMESTAMPTZ,
  ADD COLUMN accepted_at TIMESTAMPTZ,
  ADD COLUMN lost_reason TEXT;

-- ============================================
-- 模組 C: Job 管理
-- ============================================

CREATE TYPE api.job_status AS ENUM (
  'scheduled', 'in_progress', 'completed', 'cancelled'
);

CREATE TABLE api.jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id),
  customer_id   UUID REFERENCES api.customers(id),
  quote_id      UUID REFERENCES api.quotes(id),

  -- Job 資訊
  title         TEXT NOT NULL,
  description   TEXT,
  status        api.job_status DEFAULT 'scheduled',

  -- 排程
  scheduled_at  TIMESTAMPTZ,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  estimated_hours NUMERIC(5,2),
  actual_hours    NUMERIC(5,2),

  -- 成本追蹤
  estimated_cost  NUMERIC(12,2),  -- 從報價來
  actual_cost     NUMERIC(12,2),  -- 實際花費
  materials_cost  NUMERIC(12,2),

  -- 附件
  photos        JSONB DEFAULT '[]',   -- [{url, caption, type: 'before'|'after'}]
  notes         TEXT,

  -- Meta
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 模組 D: 帳務管理
-- ============================================

CREATE TYPE api.invoice_status AS ENUM (
  'draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled', 'bad_debt'
);

CREATE TABLE api.invoices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id),
  customer_id   UUID REFERENCES api.customers(id),
  job_id        UUID REFERENCES api.jobs(id),
  quote_id      UUID REFERENCES api.quotes(id),

  -- Invoice 資訊
  invoice_number TEXT UNIQUE NOT NULL,  -- INV-2026-0001
  slug          TEXT UNIQUE DEFAULT gen_random_uuid()::text,

  -- 金額（沿用 quotes 的計算邏輯）
  items         JSONB NOT NULL DEFAULT '[]',
  gst_inclusive  BOOLEAN DEFAULT true,
  subtotal      NUMERIC(12,2) GENERATED ALWAYS AS (
    -- 同 quotes 的計算邏輯
  ) STORED,
  gst           NUMERIC(12,2) GENERATED ALWAYS AS (...) STORED,
  total         NUMERIC(12,2) GENERATED ALWAYS AS (...) STORED,

  -- 付款
  status        api.invoice_status DEFAULT 'draft',
  issued_at     TIMESTAMPTZ,
  due_at        TIMESTAMPTZ,
  paid_at       TIMESTAMPTZ,
  paid_amount   NUMERIC(12,2) DEFAULT 0,
  payment_method TEXT,
  payment_ref    TEXT,

  -- Meta
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- 自動 Invoice 編號
CREATE SEQUENCE api.invoice_number_seq;

-- ============================================
-- 模組 E: 排程
-- ============================================

CREATE TABLE api.schedule_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id),
  job_id        UUID REFERENCES api.jobs(id),

  title         TEXT NOT NULL,
  start_at      TIMESTAMPTZ NOT NULL,
  end_at        TIMESTAMPTZ NOT NULL,
  all_day       BOOLEAN DEFAULT false,
  location      TEXT,

  -- 同步
  google_event_id TEXT,  -- Google Calendar 同步

  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 模組 F: 通訊紀錄
-- ============================================

CREATE TYPE api.comm_channel AS ENUM (
  'sms', 'email', 'whatsapp', 'phone', 'in_app'
);

CREATE TYPE api.comm_direction AS ENUM ('outbound', 'inbound');

CREATE TABLE api.communications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id),
  customer_id   UUID REFERENCES api.customers(id),

  channel       api.comm_channel NOT NULL,
  direction     api.comm_direction DEFAULT 'outbound',
  subject       TEXT,
  body          TEXT NOT NULL,

  -- 連結到相關資料
  quote_id      UUID REFERENCES api.quotes(id),
  job_id        UUID REFERENCES api.jobs(id),
  invoice_id    UUID REFERENCES api.invoices(id),

  -- 狀態
  sent_at       TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ,
  read_at       TIMESTAMPTZ,

  -- AI
  ai_generated  BOOLEAN DEFAULT false,
  ai_approved   BOOLEAN DEFAULT false,  -- 用戶是否確認發送

  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- AI 自動化引擎
-- ============================================

CREATE TYPE api.automation_status AS ENUM (
  'pending', 'executed', 'cancelled', 'failed'
);

CREATE TABLE api.automation_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id),

  -- 觸發
  trigger_type  TEXT NOT NULL,    -- 'quote_sent', 'invoice_overdue', etc.
  trigger_id    UUID,             -- 關聯的 quote/job/invoice ID

  -- 動作
  action_type   TEXT NOT NULL,    -- 'send_sms', 'send_email', 'create_job'
  action_data   JSONB NOT NULL,   -- {to, message, channel, ...}

  -- 排程
  scheduled_at  TIMESTAMPTZ NOT NULL,
  executed_at   TIMESTAMPTZ,
  status        api.automation_status DEFAULT 'pending',

  -- 結果
  result        JSONB,            -- {success, error, response}

  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 排程索引（用於 Cron Job 查詢待執行任務）
CREATE INDEX idx_automation_pending
  ON api.automation_tasks(scheduled_at)
  WHERE status = 'pending';
```

### 6.3 Entity Relationship Diagram

```
                    ┌──────────┐
                    │ profiles │
                    │ (Tradie) │
                    └────┬─────┘
                         │ 1:N
            ┌────────────┼────────────┐
            │            │            │
       ┌────▼────┐  ┌────▼────┐  ┌───▼─────┐
       │customers│  │  quotes │  │  jobs   │
       │         │◄─┤         ├─►│         │
       └────┬────┘  └────┬────┘  └────┬────┘
            │            │            │
            │       ┌────▼────┐       │
            │       │invoices │◄──────┘
            │       └────┬────┘
            │            │
       ┌────▼────────────▼────┐
       │   communications     │
       └──────────────────────┘

       ┌──────────────────────┐
       │  automation_tasks    │ ← AI 自動化排程
       └──────────────────────┘

       ┌──────────────────────┐
       │  schedule_events     │ ← 日曆排程
       └──────────────────────┘
```

---

## 7. 技術架構與基礎設施

### 7.1 保持現有技術棧

| 層級 | 技術 | 原因 |
|------|------|------|
| Frontend | Next.js 16 + React 19 + Tailwind 4 | 已有基礎，不需換 |
| UI | shadcn/ui | 已整合，擴展性好 |
| Backend | Next.js Route Handlers | 保持 Serverless |
| Database | Supabase (PostgreSQL) | 已有基礎，擴展即可 |
| Auth | Supabase Auth | 已整合 |
| AI | Groq Whisper + GPT-4o-mini | 保持現有 |
| Offline | idb-keyval | 保持現有 |

### 7.2 新增基礎設施

| 需求 | 方案 | 說明 |
|------|------|------|
| 背景排程 | Vercel Cron + Supabase Edge Functions | AI 自動化任務執行 |
| SMS 發送 | Twilio (NZ 號碼) 或 2Way | NZ 本地 SMS provider |
| Email 發送 | Resend 或 Supabase Email | Transactional email |
| 推送通知 | Web Push API | PWA 推送 |
| 檔案儲存 | Supabase Storage | 照片、文件 |
| PDF 產生 | jsPDF (現有) + Server-side 備案 | Invoice PDF |
| 日曆同步 | Google Calendar API | 雙向同步 |
| 會計整合 | Xero API | NZ 最大會計軟體 |
| 支付 | Stripe NZ / POLi | 線上收款 |

### 7.3 系統架構圖

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │   Mobile PWA    │  │  Desktop Web    │  │  Public Pages  │  │
│  │ (Voice + CRM)   │  │ (Full CRM/ERP)  │  │ (Quote/Invoice)│  │
│  └────────┬────────┘  └────────┬────────┘  └───────┬────────┘  │
│           │                    │                    │           │
│  ┌────────▼────────────────────▼────────────────────▼────────┐  │
│  │              IndexedDB (Offline-First Cache)              │  │
│  └────────────────────────────┬──────────────────────────────┘  │
└───────────────────────────────┼──────────────────────────────────┘
                                │ HTTPS
┌───────────────────────────────▼──────────────────────────────────┐
│                         API Layer (Vercel)                       │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────────┐ │
│  │/api/     │ │/api/     │ │/api/     │ │/api/                │ │
│  │transcribe│ │extract   │ │crm/*     │ │automation/*         │ │
│  │(Groq)   │ │(OpenAI)  │ │(CRUD)    │ │(AI Actions)         │ │
│  └─────────┘ └──────────┘ └──────────┘ └──────────────────────┘ │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Vercel Cron Jobs (自動化執行)                │   │
│  │  • 每小時: 檢查待執行 automation_tasks                    │   │
│  │  • 每天: 產生每日摘要、檢查逾期 Invoice                   │   │
│  │  • 每週: 週報、數據分析                                   │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬──────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────┐
│                       Data Layer (Supabase)                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │PostgreSQL│ │  Auth    │ │ Storage  │ │Edge Func │           │
│  │ (RLS)   │ │         │ │ (Photos) │ │(Webhooks)│           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└───────────────────────────────┬──────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────┐
│                      External Services                           │
│  ┌───────┐ ┌───────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌───────────┐ │
│  │Twilio │ │Resend │ │Stripe│ │Xero  │ │Google│ │OpenAI/Groq│ │
│  │(SMS)  │ │(Email)│ │(Pay) │ │(Acct)│ │(Cal) │ │(AI)       │ │
│  └───────┘ └───────┘ └──────┘ └──────┘ └──────┘ └───────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## 8. 分階段實施路線圖

### Phase 1: CRM Foundation（基礎客戶管理）

**目標：** 讓每張報價自動產生客戶，建立 CRM 基礎

| 任務 | 說明 | 依賴 |
|------|------|------|
| 1.1 | 建立 `customers` 表 + RLS | — |
| 1.2 | 客戶自動建立邏輯（from quote） | 1.1 |
| 1.3 | 客戶 360 View 頁面 | 1.1 |
| 1.4 | 客戶列表頁（搜尋 + 篩選） | 1.1 |
| 1.5 | Quote 連結到 Customer | 1.1, 1.2 |
| 1.6 | 歷史客戶資料遷移（現有 quotes → customers） | 1.1 |
| 1.7 | AI 客戶匹配（去重） | 1.2 |
| 1.8 | 客戶標籤系統 | 1.1 |

**交付物：**
- `/customers` 客戶列表頁
- `/customer/[id]` 客戶詳情頁（含所有 quotes）
- 自動客戶建立流程

---

### Phase 2: Quote Pipeline + Invoice（報價管線 + 帳務）

**目標：** 報價 → Job → Invoice 完整流程

| 任務 | 說明 | 依賴 |
|------|------|------|
| 2.1 | Quote Pipeline Kanban 看板 | Phase 1 |
| 2.2 | Quote 狀態擴展（加入 followed_up, expired, lost） | Phase 1 |
| 2.3 | 建立 `jobs` 表 + CRUD | Phase 1 |
| 2.4 | Accepted Quote → Auto Create Job | 2.3 |
| 2.5 | 建立 `invoices` 表 + CRUD | Phase 1 |
| 2.6 | Job Completed → Auto Generate Invoice | 2.3, 2.5 |
| 2.7 | Invoice 公開頁面 `/inv/[slug]` | 2.5 |
| 2.8 | Invoice PDF 產生 | 2.5 |
| 2.9 | 付款追蹤（手動標記） | 2.5 |
| 2.10 | Voice-to-Invoice（語音直接出帳單） | 2.5 |

**交付物：**
- `/pipeline` Kanban 看板
- `/jobs` Job 列表 + `/job/[id]` 詳情頁
- `/invoices` Invoice 列表 + `/invoice/[id]` 詳情頁
- `/inv/[slug]` 客戶 Invoice 公開頁面

---

### Phase 3: AI Automation Engine（AI 自動化引擎）

**目標：** 最大化自動化，減少人力

| 任務 | 說明 | 依賴 |
|------|------|------|
| 3.1 | 建立 `automation_tasks` 表 | — |
| 3.2 | Cron Job 執行引擎 | 3.1 |
| 3.3 | Quote Follow-up 自動化（SMS/Email） | 3.1, SMS provider |
| 3.4 | Invoice 逾期提醒自動化 | 3.1, 3.2 |
| 3.5 | AI 訊息撰寫 API | — |
| 3.6 | Communication Hub（通訊紀錄表 + UI） | Phase 2 |
| 3.7 | SMS 整合（Twilio / 2Way） | — |
| 3.8 | Email 整合（Resend） | — |
| 3.9 | AI 每日摘要推送 | 3.2, 3.5 |
| 3.10 | Automation 管理 UI（查看/取消排程任務） | 3.1 |

**交付物：**
- AI 自動 Follow-up 系統
- SMS + Email 發送能力
- `/communications` 通訊記錄頁
- AI 每日摘要通知

---

### Phase 4: Analytics + Smart Features（分析 + 智慧功能）

**目標：** 用數據驅動業務決策

| 任務 | 說明 | 依賴 |
|------|------|------|
| 4.1 | Dashboard 改版（收入、轉換率、客戶排名） | Phase 2 |
| 4.2 | 報價轉換率分析 | Phase 2 |
| 4.3 | 利潤分析（預估 vs 實際） | Phase 2 |
| 4.4 | 客戶 Lifetime Value 計算 | Phase 1, 2 |
| 4.5 | Smart Pricing 建議 | Phase 2 |
| 4.6 | 季節趨勢分析 | Phase 2 |
| 4.7 | 排程模組（日曆 UI） | Phase 2 |
| 4.8 | Google Calendar 同步 | 4.7 |
| 4.9 | 路線/區域優化建議 | 4.7 |
| 4.10 | 週報/月報自動產生 | Phase 3 |

**交付物：**
- `/analytics` 數據分析 Dashboard
- `/schedule` 排程日曆
- AI 定價建議
- 週報/月報功能

---

### Phase 5: Integrations + Team（整合 + 團隊）

**目標：** 打通生態系統，支援團隊

| 任務 | 說明 | 依賴 |
|------|------|------|
| 5.1 | Xero 整合 | Phase 2 |
| 5.2 | Stripe 線上收款 | Phase 2 |
| 5.3 | WhatsApp Business API | Phase 3 |
| 5.4 | 多用戶 + 角色權限 | — |
| 5.5 | 團隊排程（多人日曆） | 5.4, Phase 4 |
| 5.6 | Job 指派 | 5.4, Phase 2 |
| 5.7 | 團隊績效報表 | 5.4 |
| 5.8 | Referral Programme 系統 | — |
| 5.9 | PWA 增強（離線 CRM） | — |
| 5.10 | Trade Marketplace（Tradie 對 Tradie 轉介） | 5.8 |

**交付物：**
- Xero 同步
- 線上收款
- 多用戶團隊管理
- 推薦系統

---

## 9. 商業模式與定價策略

### 9.1 Freemium 模式

```
┌──────────────────────────────────────────────────────────────┐
│                     定價方案                                  │
├────────────────┬─────────────────┬───────────────────────────┤
│    Free        │     Pro         │      Team                │
│    $0/mo       │    $29/mo NZD   │     $49/mo NZD           │
│                │    ($290/yr)    │     ($490/yr)            │
├────────────────┼─────────────────┼───────────────────────────┤
│                │                 │                           │
│ ✅ 10 Voice    │ ✅ Unlimited    │ ✅ Everything in Pro      │
│    Quotes/mo   │    Voice Quotes │                           │
│                │                 │                           │
│ ✅ 基礎客戶列表│ ✅ Full CRM     │ ✅ Up to 5 users         │
│   (view only)  │   (tags, score) │                           │
│                │                 │                           │
│ ✅ 5 Invoices  │ ✅ Unlimited    │ ✅ Team calendar          │
│    /mo         │    Invoices     │                           │
│                │                 │                           │
│ ❌ No AI       │ ✅ AI Follow-up │ ✅ Job assignment         │
│    Automation  │ ✅ AI Reminders │                           │
│                │ ✅ AI Messages  │ ✅ Team reporting         │
│                │                 │                           │
│ ❌ No Pipeline │ ✅ Pipeline     │ ✅ Role permissions       │
│                │    Kanban       │                           │
│                │                 │                           │
│ ❌ No          │ ✅ Analytics    │ ✅ Priority support       │
│    Analytics   │    Dashboard    │                           │
│                │                 │                           │
│ ❌ No SMS      │ ✅ 100 SMS/mo   │ ✅ 500 SMS/mo            │
│                │    (included)   │    (included)            │
│                │                 │                           │
│                │ ✅ Xero Sync    │ ✅ Xero Sync             │
│                │                 │                           │
└────────────────┴─────────────────┴───────────────────────────┘
```

### 9.2 收入預估模型

```
假設：NZ Tradies 約 200,000 人

Year 1 目標：
  Free users: 2,000
  Pro conversion: 5% = 100 users
  Revenue: 100 × $29 × 12 = $34,800 NZD/yr

Year 2 目標：
  Free users: 10,000
  Pro conversion: 8% = 800 users
  Team conversion: 2% = 200 users
  Revenue: (800 × $29 + 200 × $49) × 12 = $396,000 NZD/yr

Year 3 目標：
  Free users: 30,000
  Pro: 2,400 | Team: 600
  + SMS add-on revenue
  + Marketplace commission
  Revenue: ~$1.2M NZD/yr
```

### 9.3 Unit Economics

```
Cost per user (估算):
  AI (Groq + OpenAI): ~$0.50/mo per active user
  SMS (Twilio): ~$0.08/SMS × 30/mo = $2.40/mo
  Supabase: ~$0.10/mo per user (at scale)
  Vercel: ~$0.05/mo per user
  ─────────────
  Total: ~$3.05/mo per Pro user

Pro ARPU: $29/mo
Gross Margin: ~89%
LTV (24mo avg): $29 × 24 × 0.89 = $619
Target CAC: < $100 (口碑驅動，低 CAC)
LTV:CAC ratio: ~6:1 ✅
```

---

## 10. 關鍵指標 (KPIs)

### 10.1 獲客指標
| 指標 | 目標 (Year 1) |
|------|---------------|
| Monthly Signups | 200+/mo |
| Activation Rate (first quote) | > 60% |
| Free → Pro Conversion | > 5% |
| Referral Rate | > 10% of new users |

### 10.2 留存指標
| 指標 | 目標 |
|------|------|
| D7 Retention | > 40% |
| D30 Retention | > 25% |
| Monthly Active Rate (Pro) | > 80% |
| Pro Churn Rate | < 5%/mo |

### 10.3 業務指標
| 指標 | 目標 |
|------|------|
| Quotes Created/User/Mo | > 15 |
| Quote → Accepted Rate | > 30% |
| Avg Quote Value | > $500 NZD |
| AI Automation Usage | > 70% of Pro users |

### 10.4 產品指標
| 指標 | 目標 |
|------|------|
| Voice-to-Quote Time | < 60 seconds |
| AI Follow-up Open Rate | > 40% |
| Offline Sync Success | > 99% |
| NPS Score | > 50 |

---

## 11. 風險與緩解策略

| 風險 | 機率 | 影響 | 緩解 |
|------|------|------|------|
| Tradies 不願用新工具 | 高 | 高 | Voice-first 降低門檻；Freemium 零風險試用 |
| NZ 市場太小 | 中 | 中 | 先佔 NZ → 擴展 AU（相似市場） |
| AI 成本上升 | 低 | 中 | 用 GPT-4o-mini 控制成本；本地算法優先 |
| 大公司抄襲 | 中 | 高 | 深度 NZ 本土化是壁壘；先發優勢 + 數據壁壘 |
| 離線功能複雜 | 中 | 中 | 已有 idb-keyval 基礎；衝突解決用 server-wins |
| 隱私合規 (NZ Privacy Act) | 低 | 高 | 最小化數據收集；不存原始音檔；加密敏感資料 |
| SMS 成本 | 中 | 低 | 限制免費方案 SMS；鼓勵用 Email/WhatsApp |

---

## 附錄：技術決策記錄

### 決策 1: 為什麼不用獨立的 CRM SaaS？
- NZ Tradies 需要的是 "Stupid Simple"，不是 Salesforce
- Voice-first 是我們的核心差異化
- 整合在同一個 App 減少切換成本

### 決策 2: 為什麼用 Vercel Cron 而不是獨立的 Queue？
- 保持 Serverless，不增加基礎設施成本
- Vercel Cron 支援到每分鐘級別，足夠用
- 如果量大了再遷移到 Supabase Edge Functions + pg_cron

### 決策 3: 為什麼 SMS 選 Twilio？
- NZ 號碼支援好
- API 穩定
- 備選：2Way（NZ 本地 provider），如果成本更低可切換

### 決策 4: 為什麼 Invoice 不直接用 Xero？
- 先自建簡單 Invoice（控制 UX + 減少依賴）
- Xero 同步作為 Pro 功能
- 很多小 Tradie 不用 Xero，自建 Invoice 反而更簡單

### 決策 5: 為什麼先不做 Payment（線上收款）？
- NZ Tradies 大多用 Bank Transfer
- Stripe 收 ~2.9% 手續費，Tradies 不願意
- Phase 5 再加，作為可選功能

---

> **下一步：** 確認此計劃後，從 Phase 1（CRM Foundation）開始實施。
