#!/usr/bin/env bash
# Render app/app.yaml placeholders into app/.build/app.yaml using values from
# `terraform output`. Call after `apx build`.
#
# Placeholders in app/app.yaml must match terraform output names (uppercased).
# See TF_OUTPUTS below for the authoritative list.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TERRAFORM_DIR="${REPO_ROOT}/terraform"
APP_DIR="${REPO_ROOT}/app"
APP_YAML_SRC="${APP_DIR}/app.yaml"
APP_YAML_OUT="${APP_DIR}/.build/app.yaml"

TF_OUTPUTS=(
  KA_ENDPOINT_NAME
  MLFLOW_EXPERIMENT_PATH
  LAKEBASE_HOST
  LAKEBASE_DATABASE_NAME
  LAKEBASE_ENDPOINT_PATH
  LAKEBASE_INSTANCE_NAME
  UC_VOLUME_FULL_NAME
  WORKSPACE_HOST
)

for cmd in terraform jq envsubst; do
  command -v "$cmd" >/dev/null || { echo "missing required tool: $cmd" >&2; exit 1; }
done

[ -f "$APP_YAML_SRC" ] || { echo "$APP_YAML_SRC not found" >&2; exit 1; }
[ -d "${APP_DIR}/.build" ] || { echo "${APP_DIR}/.build missing — run 'apx build' first" >&2; exit 1; }

TF_JSON="$(cd "$TERRAFORM_DIR" && terraform output -json)"

envsubst_vars=""
for key in "${TF_OUTPUTS[@]}"; do
  lower="$(echo "$key" | tr '[:upper:]' '[:lower:]')"
  value="$(echo "$TF_JSON" | jq -r --arg k "$lower" '.[$k].value // empty')"
  if [ -z "$value" ]; then
    echo "terraform output '$lower' missing — run 'terraform apply' first" >&2
    exit 1
  fi
  export "$key=$value"
  envsubst_vars+=" \$$key"
done

envsubst "$envsubst_vars" < "$APP_YAML_SRC" > "$APP_YAML_OUT"
# Databricks Apps canonical name is app.yaml, but apx build emits app.yml.
# Write both so whichever the platform picks up has the fully resolved config.
cp "$APP_YAML_OUT" "${APP_DIR}/.build/app.yml"
echo "Rendered $APP_YAML_OUT (and app.yml sibling)"
