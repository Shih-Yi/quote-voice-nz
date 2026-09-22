#!/usr/bin/env bash
# .claude/hooks/guard-bash.sh — PreToolUse (matcher: Bash)
# 讀 stdin 的工具呼叫 JSON，命中破壞性樣式就 exit 2 擋下；命中「使用者的關卡」
# 就回 ask，讓詢問視窗跳出來，即使 Bash 整個在 allow 清單上也一樣。
#
# 這支腳本三個工具共用：Claude Code 與 Codex 的事件叫 PreToolUse，Gemini 的叫
# BeforeTool，三邊 stdin 都把指令放在 tool_input.command。差別只在 ask：那段
# JSON 只有 Claude／Codex 認得，Gemini 收到會當成沒有裁決，於是合併就靜默過去。
# 所以非 PreToolUse 的事件遇到該問的指令，改成直接擋下——要合併就在終端機自己來。
#
# 範圍刻意限縮在「破壞性操作」與「關卡」。機密檔的讀寫不靠這裡比對字串，
# 由 .claude/settings.json 的 sandbox 在作業系統層擋（那邊的 denyRead／denyWrite）。
#
# 從 joy-restaurant-website-v2 搬來。搬的時候拿掉了 stash 那幾條——那邊擋裸 stash
# 是因為四個 worktree 共用一個 stash 堆疊，這個 repo 只有一個 checkout。
# 守著這支腳本的是 tests/hooks/guard-bash.test.ts，改之前先看那邊。
set -euo pipefail

input="$(cat)"
cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty')"
[ -z "$cmd" ] && exit 0
event="$(printf '%s' "$input" | jq -r '.hook_event_name // "PreToolUse"')"

# 建置產物：整個 rm -rf 掉是 Next.js 的例行修法，不是資料流失。只放行「每一個參數
# 都在這份清單裡」的拼法；多帶一個別的路徑就回到下面的破壞性規則。
artefact='(\.next|node_modules(/[^[:space:]]*)?|\.turbo|coverage|out|tsconfig\.tsbuildinfo)'
if printf '%s' "$cmd" | grep -qE "^rm[[:space:]]+-[rf]{2}[[:space:]]+${artefact}([[:space:]]+${artefact})*[[:space:]]*$"; then
  exit 0
fi

# git 的全域選項排在子指令前面：-C <path>、--git-dir=…、-c k=v。前面那串是吃值的
# 選項（git 自己的清單，封閉的），值是分開的一個 token；其餘開頭是 - 的一律當成
# 不吃值——不能放寬成每個選項都吃下一個字，不然 git -P merge 的 merge 會被 -P 吃掉。
g='git([[:space:]]+((-C|-c|--git-dir|--work-tree|--namespace|--super-prefix|--config-env)[[:space:]]+[^[:space:]]+|-[^[:space:]]+))*[[:space:]]+'
deny_re="rm[[:space:]]+-[a-zA-Z]*[rf]|${g}push[[:space:]].*--force([[:space:]]|$)|${g}reset[[:space:]]+--hard|${g}clean[[:space:]]+-[a-zA-Z]*f|(npx[[:space:]]+)?supabase[[:space:]]+db[[:space:]]+reset|vercel[[:space:]]+(projects?[[:space:]]+)?(rm|remove)([[:space:]]|$)|DROP[[:space:]]+(TABLE|DATABASE|SCHEMA)|TRUNCATE[[:space:]]|(curl|wget)[[:space:]].*\|[[:space:]]*(sudo[[:space:]]+)?(ba)?sh"

if printf '%s' "$cmd" | grep -qiE "$deny_re"; then
  echo "guard-bash.sh 擋下: 命中破壞性樣式 → $cmd" >&2
  exit 2
fi

# 關卡：合併、站到 main 上。使用者可能這一輪就是要它做，所以不拒絕，但一定要問。
ask_re="${g}merge([[:space:]]|$)|${g}(checkout|switch)[[:space:]]+(main|master)([[:space:]]|$)"

if printf '%s' "$cmd" | grep -qE "$ask_re"; then
  if [ "$event" = "PreToolUse" ]; then
    printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"合併進 main 是使用者的關卡"}}\n'
    exit 0
  fi
  echo "guard-bash.sh 擋下: 這個工具沒有「問一下」可用，合併請在終端機自己來 → $cmd" >&2
  exit 2
fi
exit 0
