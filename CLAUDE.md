# CLAUDE.md - Project: QuoteTalk (NZ Voice-to-Quote Agent)

## Project Name: QuoteTalk Mission: To provide New Zealand tradies (plumbers, electricians, landscapers, etc.) with a "Stupid Simple" voice-to-quote solution that eliminates the friction of manual data entry in the field.

## Core Value Proposition:

- **Voice-First Workflow:** Capture job details via voice while on-site or driving, reducing administrative backlog.
- **NZ Localization:** Deep integration of NZ business logic (15% GST, NZD currency) and recognition of local Kiwi slang/terminology.
- **Resilient Connectivity:** An "Offline-First" approach using IndexedDB to ensure no data loss in remote Canterbury locations with poor cellular reception.
- **Frictionless UX:** A mobile-optimized, thumb-friendly interface designed for one-handed operation in rugged work environments.

## 🛠 Tech Stack & Philosophy
- **Framework:** Next.js (App Router), TypeScript, Tailwind CSS.
- **AI Stack:** Groq Whisper API (Audio), Vercel AI SDK (Use `openai/gpt-oss-120b`).
<!-- **Transcriber:** OpenAI Whisper API (`whisper-1`) -->
- **Transcriber:** Groq Whisper API (`whisper-large-v3`)
- **Orchestrator:** Vercel AI SDK (`ai` + `@ai-sdk/groq`)
- **LLM Model:** Use `openai/gpt-oss-120b` (via Groq) for extraction to minimize latency and cost.
- **Audio:** Client-side recording -> Groq API (Text) -> Groq API (JSON).
- **Backend:** Serverless Functions (Vercel), Supabase (DB/Auth).
- **Philosophy:** "Stupid Simple". No over-engineering. Minimize dependencies. One-click flow.
- **Primary Goal:** One-handed mobile operation in field conditions.

## 💾 Storage Strategy (MVP - Ultra Simple)
- **Library:** `idb-keyval` (IndexedDB).
- **Offline Logic:** 1. Capture audio as Blob.
  2. Immediate Feedback: "Draft saved locally" (UX first!).
  3. Try Groq API. On success, move to 'History'.
  4. On failure/Offline: Keep in `idb-keyval` as `pending_sync`.
- **Sync Logic:** - Show "Sync All" button with a counter.
  - Auto-check on app launch.
- **Safety:** Add "Download Audio" option for pending items as a fallback.
- **Limit:** Max 2 mins recording at 128kbps (~2MB typical, 24MB hard cap in `lib/storage/pending.ts`). Stays under Whisper's 25MB server limit.

## 📤 Delivery Strategy
- **Primary:** Generate a unique, public-facing URL for each quote (e.g., ksq.nz/q/abc-123).
- **Format:** Responsive Web Page (Mobile-optimized).
- **PDF Export:** Provide a "Download PDF" button on the quote page.
- **Sharing:** Use the Web Share API to allow users to send the link via SMS, WhatsApp, or Email directly from their phone.

## 🎨 Design System (Brand Colors)
**Apply these variables in globals.css or Tailwind config:**
- **primary:** #6366F1; (Indigo 500)
- **primary-dark:** #4F46E5; (Indigo 600)
- **secondary:** #10B981; (Emerald 500)
- **cta:** #6366F1; (Call to Action)
- **bg:** #F5F5F5; (Light Gray Background)
- **bg-white:** #FFFFFF;
- **text:** #111827; (Slate 900)
- **text-muted:** #6B7280; (Slate 500)
- **border:** #E5E7EB;

## 📱 UI/UX & RWD Strategy (Mobile-First)
- **Breakpoints:** Design for mobile (iPhone/Android) first, then scale to desktop.
- **Touch Targets:** All buttons must be at least 44x44px for easy tapping.
- **Core Action:** The "Record" button must be central, large, and accessible by the thumb.
- **Feedback:** Use haptic feedback (Vibration API) or clear visual cues during recording.
- **Inputs:** Use inputmode="decimal" for price fields to trigger numeric keyboards.
- **Layout:** Use Sticky Footers for primary actions (e.g., "Send Quote").

## 💻 Desktop Optimization (Scalability)
- **Container:** Main content should be centered with `max-w-2xl mx-auto` on screens > 768px.
- **Layout:** Switch from single column to dual-column (List + Editor) on `lg` breakpoint.
- **Typography:** Ensure font sizes remain readable but not overly giant on large screens.
- **Hover States:** Add `:hover` effects for desktop users (which are ignored on mobile).

## 🇳🇿 New Zealand Business Logic (Strict Adherence)
- **GST:** All calculations default to 15% GST. Quote items must support "GST inclusive" and "GST exclusive" toggles.
- **Spelling:** Always use New Zealand/British English spelling conventions. Example: Labour (not Labor), Organise (not Organize), Centred (not Centered).
- **Currency:** Default currency is NZD ($).
- **Tax:** 15% GST. Default labels should be "GST Inclusive" or "Plus GST".
- **Transcription Logic:** Instruct AI to transcribe and extract items using NZ spelling (e.g., "General Labour").
- **Date Format:** Use DD/MM/YYYY for all UI displays.
- **Address:** Format for NZ Post standards.
- **Bank Accounts:** Validate NZ bank account format (XX-XXXX-XXXXXXX-XX).

## 🤖 AI Agent Behavior (Persona)
- **Input:** Handle messy transcribed text from Whisper (NZ accents/slang like "grand", "bucks", "mate").
- **Output:** Strict JSON output using `generateObject` for structured data.
- **Tone:** Professional yet kiwi-friendly (concise and helpful).

## 💻 Development Patterns
- **Components:** Use shadcn/ui. Keep components small and functional.
- **State Management:** URL state or simple React State. Avoid Redux/Zustand unless mandatory.
- **API Routes:** Use Next.js Route Handlers. Implement error handling for API timeouts.
- **Audio Processing:** Client-side conversion to low-bitrate MP3 before upload to save bandwidth.

## 🛠 常用指令
- 開發伺服器：`npm run dev`
- 全部測試：`npm test`（vitest run；含 `tests/hooks/` 那 53 支守 hook 的測試）
- 單一測試：`npx vitest run lib/utils/__tests__/gst.test.ts`
- 型別檢查：`npx tsc --noEmit`
- Lint：`npm run lint`
- 正式建置：`npm run build`
- DB 型別：`npx supabase gen types typescript --project-id <id>`
- Migration：新增 `supabase/migrations/NNN_<slug>.sql`，套用走 `supabase db push`（會跳詢問）

## 開發流程（強制）
1. 任何新功能先進 Plan Mode，寫規格到 `docs/plans/`，我核准後才動手
2. TDD：先寫失敗測試（RED）→ 最小實作（GREEN）→ 重構 → commit。
   事後補的測試（修 bug、補覆蓋率）沒有經過 RED 階段，必須另外證明它會失敗：
   把它守護的那段邏輯暫時改回有缺陷的樣子，確認測試變紅，再還原。
   從來沒有紅過的測試，不知道自己在守什麼。
3. 小步提交：一個 commit 只做一件事，Conventional Commits 格式
4. 每個 feature branch 合併前必跑：`npm test` + `npx tsc --noEmit` + `npm run lint` + `npm run build`
5. 手機畫面被改到的功能，合併前由人在手機（或 DevTools 手機模式）走過一次——
   這個產品的核心是單手操作，自動測試量不到拇指

## 安全規則（不可妥協）
- 所有進來的資料（Route Handler 的 body、Server Action 參數、Supabase 回傳）先過 zod，不信任何外部資料
- Supabase：RLS 一律開；`service_role` key 只在 server 端用，永遠不進 client bundle
- 對外 API（轉錄、送報價、匿名建立）必須有 rate limiting（Upstash）
- 機密只放 `.env.local`／Vercel 環境變數；禁止寫進程式碼或 commit
- Stripe webhook 必驗簽章；金額一律 integer cents，禁止 float
- 上傳音訊限制大小與 MIME（`lib/storage/pending.ts` 的 24MB 硬上限）

### 權限邊界（從 joy-restaurant-website-v2 的 `docs/plans/50-a-wall-not-a-gate.md` 搬來）
- 邊界是**圍牆**不是關卡：專案內的改動不問，由 Bash sandbox 在作業系統層守住
  「寫只到工作目錄、機密檔讀寫都禁、憑證目錄與其他專案讀不到」。設定在 `.claude/settings.json`。
- **`.codex/`、`.gemini/`、`.agents/` agent 禁寫。** 那三個是鏡像，正本在 `.claude/`。
- **`.claude/settings.json` 與 `.claude/hooks/` 是「改之前問」。** 卡住的時候先問
  「這個檢查值不值得為它開一個窗口」，通常答案是不值得。**不要提議放寬這道牆。**
  sandbox 的 `denyWrite` 仍然蓋著 hooks 目錄，所以用 shell 改它會拿到
  `Operation not permitted`，那不是壞掉，是牆還在。要改就用 Edit 工具走 ask。
- 守著 hook 的不是眼睛，是 `tests/hooks/*.test.ts`。改 hook 先改測試。
- 仍然要問的是往外走的動作：`git push`、`vercel`、`supabase db push`、合併進 main、動 CI、加套件。
- **預設不合併進 main。** 使用者在當回合明說才可以。

## One rule file, three tools

**`CLAUDE.md` is the source. Everything else points at it.**

```
CLAUDE.md                      ← the file. Claude reads it natively
AGENTS.md                      → CLAUDE.md          (symlink; Codex reads this name)
GEMINI.md                      → CLAUDE.md          (symlink; Gemini reads this name)
.codex/hooks/*.sh              → ../../.claude/hooks/*.sh
.gemini/hooks/guard-bash.sh    → ../../.claude/hooks/guard-bash.sh
.agents/skills                 → ../.claude/skills
.gemini/skills                 → ../.claude/skills
```

Edit the real file; never a copy. The old hand-copied `.agents/skills` had been
search-and-replaced "Claude → Codex" and turned the copywriter Claude Hopkins into
"Codex Hopkins" — that is what a second copy does.

Stop hook（`guard-stop.sh`）只掛在 Claude 與 Codex；Gemini 跑同一支 `guard-bash.sh`，但沒有收尾檢查。

## 完成的定義（Definition of Done）
測試綠 + tsc 無錯 + lint 無錯 + build 過 + 規格文件已更新 + 受影響的手機畫面有人走過

## ⚠️ Constraints
- **Whisper Limits:** Maximum 25MB per request. Implement chunking only if requested.
- **Pricing:** Prefer `openai/gpt-oss-120b` via Groq for structured data extraction to keep costs near-zero.
- **Privacy:** Never store raw audio files longer than necessary for transcription.

# Voice Interaction & AI Parsing Error Handling Strategy

This document outlines the hierarchical error-handling mechanisms for voice recognition and AI semantic parsing to balance User Experience (UX) with data integrity.

---

## 🛑 High Priority: Speech Recognition Failure (ASR)

**Trigger:** The system fails to convert speech into text (e.g., background noise, silence, or technical error).

* **Handling Logic:** * Interrupt the current process immediately.
    * Prompt the user to retry while providing an alternative text input method.
* **UX Interaction:**
    * **Tactile:** Short haptic vibration.
    * **Audio:** Brief voice prompt: *"Sorry, I didn't catch that. Could you say it again?"*
    * **UI:** Display a "Retry" button and a "Type instead" backup option.

---

## ⚠️ Medium Priority: Low AI Confidence Score

**Trigger:** The AI successfully parses the text but returns a confidence score **$< 0.6$** for entity extraction or intent classification.

* **Handling Logic:** * Enter a "Validation Mode."
    * Display the parsing results while highlighting uncertain fields for user verification.
* **UX Interaction:**
    * **Status Indicator:** Yellow warning theme.
    * **Interaction:** Provide "One-tap confirm" or "Quick edit" buttons to allow users to manually correct specific fields.

---

## ℹ️ Low Priority: Missing Required Fields

**Trigger:** The speech is parsed clearly, but the user has omitted mandatory information (e.g., an "Amount" in a ledger app or a "Date" in a task).

* **Handling Logic:** * Generate a "Draft" entry rather than blocking the workflow.
    * Flag missing fields for asynchronous completion.
* **UX Interaction:**
    * **Flow:** Allow the user to "Save as Draft."
    * **Prompt:** Display a subtle "Complete later to send" notification and mark the item in the list view for later attention.

---

**Guiding Principle:** Prioritize data flow and minimize friction. Only introduce manual intervention during high-risk or high-uncertainty events.



## 🛡️ Security & Privacy
專案外的檔案（`~/OhMyProject` 其他專案、`~/.ssh`、`~/.aws`、Vercel／Supabase／Stripe 的
CLI 憑證、`.env*`）由 `.claude/settings.json` 的 sandbox 在作業系統層擋住，不靠這裡
用文字叮嚀。原本這一段引用的 `.gemini/config.json` 從來不存在，2026-09-15 換成上面的
「權限邊界」。
