#!/usr/bin/env bash
# Render app/databricks.yml from app/databricks.yml.tpl using terraform outputs.
#
# workspace.host and workspace.profile cannot use ${var.x} interpolation in a
# Databricks bundle (auth resolves before variable substitution), so we render
# them into a literal databricks.yml at deploy time. The rendered file is
# gitignored; edit the .tpl instead.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TERRAFORM_DIR="${REPO_ROOT}/terraform"
APP_DIR="${REPO_ROOT}/app"
TPL="${APP_DIR}/databricks.yml.tpl"
OUT="${APP_DIR}/databricks.yml"

TF_OUTPUTS=(
  WORKSPACE_HOST
  DATABRICKS_PROFILE
  KA_ENDPOINT_NAME
  UC_VOLUME_FULL_NAME
)

for cmd in terraform jq envsubst; do
  command -v "$cmd" >/dev/null || { echo "missing required tool: $cmd" >&2; exit 1; }
done

[ -f "$TPL" ] || { echo "$TPL not found" >&2; exit 1; }

TF_JSON="$(cd "$TERRAFORM_DIR" && terraform output -json)"

envsubst_vars=""
for key in "${TF_OUTPUTS[@]}"; do
  lower="$(echo "$key" | tr '[:upper:]' '[:lower:]')"
  value="$(jq -r --arg k "$lower" '.[$k].value // empty' <<<"$TF_JSON")"
  if [ -z "$value" ]; then
    echo "terraform output '$lower' missing — run 'terraform apply' first" >&2
    exit 1
  fi
  export "$key=$value"
  envsubst_vars+=" \$$key"
done

envsubst "$envsubst_vars" < "$TPL" > "$OUT"
echo "Rendered $OUT"
