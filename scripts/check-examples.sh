#!/usr/bin/env bash
# Verify that all book examples build and format cleanly, and that
# prose/code blocks do not re-introduce removed Zen C keywords.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TMP_BIN="/tmp/zenc_book_check_bin"
TMP_LOG="/tmp/zenc_book_check.log"
mkdir -p "$(dirname "$TMP_BIN")"

echo "==> Building all runnable examples..."
ok=0
fail=0
while IFS= read -r -d '' f; do
    if grep -qE '^(fn main|test )' "$f"; then
        if timeout 60 zc build -q "$f" -o "$TMP_BIN" >"$TMP_LOG" 2>&1; then
            ok=$((ok + 1))
        else
            fail=$((fail + 1))
            echo "FAIL (build): $f"
            cat "$TMP_LOG"
        fi
    fi
done < <(find examples -name '*.zc' -print0 | sort -z)

echo "Examples built: $ok passed, $fail failed"
if [ "$fail" -ne 0 ]; then
    exit 1
fi

echo "==> Checking formatting with zc-format --check..."
fmt_fail=0
while IFS= read -r -d '' f; do
    if ! zc-format --check "$f" >/dev/null 2>&1; then
        fmt_fail=$((fmt_fail + 1))
        echo "FAIL (format): $f"
    fi
done < <(find examples -name '*.zc' -print0 | sort -z)

echo "Format check: $fmt_fail failed"
if [ "$fmt_fail" -ne 0 ]; then
    exit 1
fi

echo "==> Checking examples for removed syntax..."
if grep -rnE '^\s*(autofree|unless|guard|repeat)\b|^\s*do \{' examples --include='*.zc'; then
    echo "FAIL: Removed syntax found in examples/"
    exit 1
fi

rm -f "$TMP_BIN" "$TMP_LOG"
echo "All checks passed!"
