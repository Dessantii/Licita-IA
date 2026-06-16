#!/bin/bash
set -e
pnpm install --frozen-lockfile
timeout 90 pnpm --filter db push || echo "Schema push timed out or had no changes — continuing"
