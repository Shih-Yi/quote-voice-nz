#!/usr/bin/env bash
# .claude/hooks/guard-stop.sh — Stop hook（session 結束時觸發）
# 收尾檢查：staged 機密檔、focused test、殘留 debug。
# 注意：Stop hook 的 exit 2 是「叫 Claude 繼續修」，不是擋下；
#       stop_hook_active 檢查可避免無限迴圈（提醒一次後就放行）。
# 守著這支腳本的是 tests/hooks/guard-stop.test.ts。
set -uo pipefail

input="$(cat)"
if [ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false')" = "true" ]; then
  exit 0
fi
[ "$(git rev-parse --is-inside-work-tree 2>/dev/null)" = "true" ] || exit 0

problems=""
# .env.example 是文件，刻意進版控；其餘 .env* 一律當機密。
secret_re='(^|/)\.env($|\.)|(^|/)\.vercel/|(^|/)supabase/\.temp/|\.pem$|\.key$'
staged_secrets="$(git diff --cached --name-only 2>/dev/null | grep -E "$secret_re" | grep -vE '(^|/)\.env\.example$' || true)"
if [ -n "$staged_secrets" ]; then
  problems="${problems}Secret file(s) staged for commit:\n$(printf '%s' "$staged_secrets" | sed 's/^/  - /')\n"
fi

if [ -n "$(git rev-parse HEAD 2>/dev/null)" ]; then
  tracked="$(git diff --name-only HEAD 2>/dev/null || true)"
else
  tracked="$(git diff --cached --name-only 2>/dev/null || true)"
fi
changed="$( { printf '%s\n' "$tracked"; git ls-files --others --exclude-standard 2>/dev/null; } \
            | sort -u | grep -Ei '\.(js|ts|jsx|tsx|mjs|cjs)$' || true)"

focus_hits=""; debug_hits=""
while IFS= read -r f; do
  [ -z "$f" ] && continue
  [ -f "$f" ] || continue
  case "$f" in
    *.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx)
      grep -qE '\b(it|test|describe)\.only\(' "$f" && focus_hits="${focus_hits}  - $f\n" ;;
  esac
  grep -qE '\bdebugger\b|console\.log\(' "$f" \
    && debug_hits="${debug_hits}  - $f\n"
done <<< "$changed"

[ -n "$focus_hits" ] && problems="${problems}Focused test(s) left in:\n${focus_hits}"
[ -n "$debug_hits" ] && problems="${problems}Leftover debug statement(s):\n${debug_hits}"

if [ -n "$problems" ]; then
  printf 'Session-end checks failed:\n%b\nFix these, then stop again to override.\n' "$problems" >&2
  exit 2
fi
exit 0
