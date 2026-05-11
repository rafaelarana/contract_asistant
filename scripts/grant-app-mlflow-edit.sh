#!/usr/bin/env bash
# Idempotently grant the deployed app's service principal CAN_EDIT on the
# MLflow experiment used by the KA agent.
#
# MLFLOW_EXPERIMENT is not a supported Databricks Apps bundle resource kind,
# so we can't declare this grant in databricks.yml. Runs as a post-deploy
# step — `databricks permissions update` is PATCH semantics (additive),
# so re-running is safe.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TERRAFORM_DIR="${REPO_ROOT}/terraform"
APP_NAME="geec-assistant"

for cmd in terraform databricks jq; do
  command -v "$cmd" >/dev/null || { echo "missing required tool: $cmd" >&2; exit 1; }
done

TF_JSON="$(cd "$TERRAFORM_DIR" && terraform output -json)"
PROFILE="$(jq -r '.databricks_profile.value' <<<"$TF_JSON")"
EXPERIMENT_ID="$(jq -r '.mlflow_experiment_id.value // empty' <<<"$TF_JSON")"

if [ -z "$EXPERIMENT_ID" ]; then
  echo "terraform output 'mlflow_experiment_id' missing — run 'terraform apply' first" >&2
  exit 1
fi

SP_APP_ID="$(databricks apps get "$APP_NAME" -p "$PROFILE" 2>/dev/null \
  | jq -r '.service_principal_client_id // empty')"

if [ -z "$SP_APP_ID" ]; then
  echo "App '$APP_NAME' not deployed yet (or service principal not ready); skipping" >&2
  exit 0
fi

ACL=$(jq -n --arg sp "$SP_APP_ID" '{
  access_control_list: [
    { service_principal_name: $sp, permission_level: "CAN_EDIT" }
  ]
}')

databricks permissions update experiments "$EXPERIMENT_ID" -p "$PROFILE" \
  --json "$ACL" >/dev/null

echo "Granted CAN_EDIT on experiment $EXPERIMENT_ID to SP $SP_APP_ID"
