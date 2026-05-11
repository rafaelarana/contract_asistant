#!/usr/bin/env bash
# Idempotently grant the deployed app's service principal a Postgres role on
# the Lakebase chat-memory project so it can authenticate via
# /api/2.0/postgres/credentials.
#
# The Databricks Apps bundle resource binding `database:` only works for
# Database Instances (managed Postgres), not for Lakebase Autoscaling Projects.
# For Autoscaling Projects we must create a Postgres role that maps the SP's
# application_id to a postgres role with the right privileges.
#
# This script must run AFTER `databricks bundle deploy` (which creates the app
# and its SP) but can safely re-run — it no-ops when the role already exists.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TERRAFORM_DIR="${REPO_ROOT}/terraform"

for cmd in terraform databricks jq; do
  command -v "$cmd" >/dev/null || { echo "missing required tool: $cmd" >&2; exit 1; }
done

TF_JSON="$(cd "$TERRAFORM_DIR" && terraform output -json)"
PROFILE="$(jq -r '.databricks_profile.value' <<<"$TF_JSON")"
PROJECT="$(jq -r '.lakebase_project.value' <<<"$TF_JSON")"
BRANCH="${PROJECT}/branches/production"
APP_NAME="geec-assistant"
ROLE_ID="app-${APP_NAME}"
ROLE_PATH="${BRANCH}/roles/${ROLE_ID}"

# Resolve the app SP's application_id (OAuth username for Postgres).
SP_APP_ID="$(databricks apps get "$APP_NAME" -p "$PROFILE" 2>/dev/null \
  | jq -r '.service_principal_client_id // empty')"

if [ -z "$SP_APP_ID" ]; then
  echo "App '$APP_NAME' not deployed yet (or service principal not ready); skipping" >&2
  exit 0
fi

ROLE_SPEC=$(jq -n --arg id "$SP_APP_ID" '{
  spec: {
    identity_type: "SERVICE_PRINCIPAL",
    postgres_role: $id,
    auth_method: "LAKEBASE_OAUTH_V1",
    membership_roles: ["DATABRICKS_SUPERUSER"]
  }
}')

if databricks postgres get-role "$ROLE_PATH" -p "$PROFILE" >/dev/null 2>&1; then
  # Reconcile in case the application_id has changed (e.g. app recreated).
  databricks postgres update-role "$ROLE_PATH" "spec" -p "$PROFILE" \
    --json "$ROLE_SPEC" >/dev/null
  echo "Reconciled Postgres role $ROLE_PATH for SP $SP_APP_ID"
else
  databricks postgres create-role "$BRANCH" -p "$PROFILE" \
    --role-id "$ROLE_ID" --json "$ROLE_SPEC" >/dev/null
  echo "Created Postgres role $ROLE_PATH for SP $SP_APP_ID"
fi
