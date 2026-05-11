#!/usr/bin/env bash
# Deploy the Databricks Asset Bundle. Assumes `apx build` and
# `scripts/render-app-config.sh` have already run so `app/.build/app.yaml`
# contains fully resolved values.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="${REPO_ROOT}/app"
TARGET="${1:-dev}"

command -v databricks >/dev/null || { echo "databricks CLI not found" >&2; exit 1; }

cd "$APP_DIR"
databricks bundle deploy -t "$TARGET"
