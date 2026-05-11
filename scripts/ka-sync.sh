#!/usr/bin/env bash
# Idempotent Knowledge Assistant reconciler.
#
# Invoked by Terraform's `external` data source (terraform/knowledge_assistant.tf).
# Reads a JSON query from stdin, produces a flat JSON object on stdout.
#
# Input (stdin):
#   {
#     "display_name":        "GEEC Contract Assistant",
#     "description":         "...",
#     "instructions":        "...",
#     "source_display_name": "GEEC Docs Volume",
#     "source_description":  "...",
#     "volume_path":         "/Volumes/<catalog>/<schema>/<volume>",
#     "profile":             "azure-vm-workspace"
#   }
#
# Output (stdout): a JSON object with strings only (Terraform's `external`
# provider requires flat string values).
#
# Behavior:
#   1. Lists existing KAs. If one with display_name exists, reuse it;
#      otherwise create.
#   2. Lists sources for the KA. If one with source_display_name exists,
#      reuse it; otherwise create.
#   3. On create OR if the files.path differs, trigger a sync.
#   4. Resolves the MLflow experiment_id to a workspace path.

set -euo pipefail

command -v databricks >/dev/null || { echo '{"error":"databricks CLI not found"}' >&2; exit 1; }
command -v jq         >/dev/null || { echo '{"error":"jq not found"}' >&2; exit 1; }

INPUT="$(cat)"
DISPLAY_NAME=$(jq -r '.display_name'        <<<"$INPUT")
DESCRIPTION=$(jq -r '.description'         <<<"$INPUT")
INSTRUCTIONS=$(jq -r '.instructions'        <<<"$INPUT")
SRC_NAME=$(jq -r '.source_display_name'   <<<"$INPUT")
SRC_DESC=$(jq -r '.source_description'    <<<"$INPUT")
VOLUME_PATH=$(jq -r '.volume_path'           <<<"$INPUT")
PROFILE=$(jq -r '.profile'                <<<"$INPUT")

DB=(databricks -p "$PROFILE" -o json)

# --- 1. Reconcile KA ---------------------------------------------------------
KA_JSON=$("${DB[@]}" knowledge-assistants list-knowledge-assistants \
  | jq --arg n "$DISPLAY_NAME" '[.[]? | select(.display_name==$n)] | first // empty')

if [[ -z "$KA_JSON" ]]; then
  # Create
  KA_JSON=$("${DB[@]}" knowledge-assistants create-knowledge-assistant \
    "$DISPLAY_NAME" "$DESCRIPTION" \
    --instructions "$INSTRUCTIONS")
else
  # Update instructions + description if drift (safe no-op if identical).
  KA_NAME=$(jq -r '.name' <<<"$KA_JSON")
  BODY=$(jq -n \
    --arg dn "$DISPLAY_NAME" \
    --arg ds "$DESCRIPTION" \
    --arg ins "$INSTRUCTIONS" \
    '{display_name:$dn, description:$ds, instructions:$ins}')
  KA_JSON=$("${DB[@]}" knowledge-assistants update-knowledge-assistant \
    "$KA_NAME" "display_name,description,instructions" \
    --json "$BODY")
fi

KA_ID=$(jq -r '.id'              <<<"$KA_JSON")
KA_NAME=$(jq -r '.name'            <<<"$KA_JSON")
ENDPOINT_NAME=$(jq -r '.endpoint_name'   <<<"$KA_JSON")
EXPERIMENT_ID=$(jq -r '.experiment_id'   <<<"$KA_JSON")

# --- 2. Reconcile knowledge source ------------------------------------------
SRC_JSON=$("${DB[@]}" knowledge-assistants list-knowledge-sources "$KA_NAME" \
  | jq --arg n "$SRC_NAME" '[.[]? | select(.display_name==$n)] | first // empty')

SOURCE_CREATED=false
if [[ -z "$SRC_JSON" ]]; then
  BODY=$(jq -n \
    --arg dn "$SRC_NAME" \
    --arg ds "$SRC_DESC" \
    --arg vp "$VOLUME_PATH" \
    '{display_name:$dn, description:$ds, source_type:"files", files:{path:$vp}}')
  SRC_JSON=$("${DB[@]}" knowledge-assistants create-knowledge-source \
    "$KA_NAME" --json "$BODY")
  SOURCE_CREATED=true
else
  # If volume path drifted, update display_name/description (source_type/path
  # are immutable per the API; a path change requires re-create).
  CURRENT_PATH=$(jq -r '.files.path // ""' <<<"$SRC_JSON")
  if [[ "$CURRENT_PATH" != "$VOLUME_PATH" ]]; then
    echo "{\"error\":\"knowledge source volume_path drift: have=$CURRENT_PATH want=$VOLUME_PATH; delete source manually to recreate\"}" >&2
    exit 1
  fi
fi

SOURCE_ID=$(jq -r '.id'   <<<"$SRC_JSON")
SOURCE_NAME=$(jq -r '.name' <<<"$SRC_JSON")

# --- 3. Trigger sync on first create ----------------------------------------
if [[ "$SOURCE_CREATED" == "true" ]]; then
  "${DB[@]}" knowledge-assistants sync-knowledge-sources "$KA_NAME" >/dev/null 2>&1 || true
fi

# --- 4. Resolve experiment path ---------------------------------------------
EXPERIMENT_PATH=$("${DB[@]}" experiments get-experiment "$EXPERIMENT_ID" 2>/dev/null \
  | jq -r '.experiment.name // ""')

# --- Output (all values must be strings) -------------------------------------
jq -n \
  --arg ka_id          "$KA_ID" \
  --arg ka_name        "$KA_NAME" \
  --arg endpoint_name  "$ENDPOINT_NAME" \
  --arg experiment_id  "$EXPERIMENT_ID" \
  --arg experiment_path "$EXPERIMENT_PATH" \
  --arg source_id      "$SOURCE_ID" \
  --arg source_name    "$SOURCE_NAME" \
  --arg source_created "$SOURCE_CREATED" \
  '{ka_id:$ka_id, ka_name:$ka_name, endpoint_name:$endpoint_name, experiment_id:$experiment_id, experiment_path:$experiment_path, source_id:$source_id, source_name:$source_name, source_created:$source_created}'
