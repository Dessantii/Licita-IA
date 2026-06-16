#!/bin/bash
set -e
pnpm install --frozen-lockfile
timeout 90 pnpm --filter db push || echo "Schema push timed out or had no changes — continuing"

# Ensure Chromium is present in the workspace cache (persists across restarts)
export PLAYWRIGHT_BROWSERS_PATH="/home/runner/workspace/.cache/ms-playwright"
CHROMIUM_1="$PLAYWRIGHT_BROWSERS_PATH/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell"
CHROMIUM_2="$PLAYWRIGHT_BROWSERS_PATH/chromium-1217/chrome-linux64/chrome"
CHROMIUM_3="$PLAYWRIGHT_BROWSERS_PATH/chromium-1169/chrome-linux/chrome"

if [ -f "$CHROMIUM_1" ] || [ -f "$CHROMIUM_2" ] || [ -f "$CHROMIUM_3" ]; then
  echo "[post-merge] Chromium already cached, skipping download."
else
  echo "[post-merge] Chromium not cached, attempting download (timeout 300s)..."
  timeout 300 pnpm --filter @workspace/api-server exec playwright install chromium \
    && echo "[post-merge] Chromium download complete." \
    || echo "[post-merge] Chromium download skipped (timeout or error) — RPA features unavailable until next deploy."
fi
