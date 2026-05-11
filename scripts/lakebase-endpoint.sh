#!/usr/bin/env bash
# Resolve a Lakebase endpoint's hostname via the Databricks CLI.
#
# Invoked by Terraform's `external` data source (terraform/lakebase.tf).
# Input (stdin):  {"endpoint_name":"projects/.../endpoints/primary","profile":"azure-vm-workspace"}
# Output (stdout): {"host":"ep-xxx.database.<region>.azuredatabricks.net"}

set -euo pipefail

command -v databricks >/dev/null || { echo '{"error":"databricks CLI not found"}' >&2; exit 1; }
command -v jq         >/dev/null || { echo '{"error":"jq not found"}' >&2; exit 1; }

INPUT=$(cat)
ENDPOINT_NAME=$(jq -r '.endpoint_name' <<<"$INPUT")
PROFILE=$(jq -r '.profile'        <<<"$INPUT")

HOST=$(databricks -p "$PROFILE" -o json postgres get-endpoint "$ENDPOINT_NAME" \
  | jq -r '.status.hosts.host // ""')

[[ -n "$HOST" ]] || { echo "{\"error\":\"endpoint host not yet available for $ENDPOINT_NAME\"}" >&2; exit 1; }

jq -n --arg host "$HOST" '{host:$host}'
