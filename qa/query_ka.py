#!/usr/bin/env python3
"""
Send a message to the GEEC Knowledge Assistant endpoint and print the full
HTTP response (headers + body) in plain text.

Automatically generates an OAuth token using the Databricks CLI profile,
environment variables, or Azure CLI credentials.

Usage:
    python qa/query_ka.py "Quin és el procediment per licitar un contracte menor?"
    python qa/query_ka.py --endpoint ka-50dc61ea-endpoint "What policies are documented?"
    python qa/query_ka.py --profile my-profile "Hola"

Requires:
    - databricks-sdk
    - requests
"""

import argparse
import json
import sys

import requests
from databricks.sdk import WorkspaceClient
from databricks.sdk.config import Config


DEFAULT_ENDPOINT = "ka-084bff11-endpoint"
DEFAULT_HOST = "https://adb-7405619414775196.16.azuredatabricks.net"


def get_token(profile: str | None = None, host: str | None = None) -> tuple[str, dict[str, str]]:
    """
    Generate a Databricks OAuth/PAT token automatically.

    Tries the SDK credential chain in order:
      1. Explicit --profile (databrickscfg)
      2. DATABRICKS_TOKEN / DATABRICKS_HOST env vars
      3. Azure CLI (`az login`) via azure-identity
      4. Databricks CLI OAuth cache (`databricks auth login`)

    Returns (workspace_host, auth_headers).
    """
    kwargs: dict = {}
    if profile:
        kwargs["profile"] = profile
    if host:
        kwargs["host"] = host

    config = Config(**kwargs)
    ws = WorkspaceClient(config=config)

    # Force credential resolution — this triggers OAuth token generation
    auth_headers: dict[str, str] = ws.config.authenticate()

    if not auth_headers:
        print("ERROR: Could not generate authentication token.", file=sys.stderr)
        print("Make sure one of the following is configured:", file=sys.stderr)
        print("  - DATABRICKS_HOST + DATABRICKS_TOKEN env vars", file=sys.stderr)
        print("  - A Databricks CLI profile (~/.databrickscfg)", file=sys.stderr)
        print("  - Azure CLI login (az login)", file=sys.stderr)
        sys.exit(1)

    return ws.config.host, auth_headers


def main():
    parser = argparse.ArgumentParser(
        description="Query a Databricks Knowledge Assistant endpoint"
    )
    parser.add_argument("message", nargs="+", help="The message to send")
    parser.add_argument(
        "--endpoint", "-e", default=DEFAULT_ENDPOINT,
        help=f"KA endpoint name (default: {DEFAULT_ENDPOINT})",
    )
    parser.add_argument(
        "--profile", "-p", default=None,
        help="Databricks CLI profile from ~/.databrickscfg",
    )
    parser.add_argument(
        "--host", default=DEFAULT_HOST,
        help=f"Databricks workspace URL (default: {DEFAULT_HOST})",
    )
    args = parser.parse_args()

    message = " ".join(args.message)

    # --- Authenticate ---
    print(">>> Generating token...", file=sys.stderr)
    workspace_host, auth_headers = get_token(profile=args.profile, host=args.host)

    # Show auth method (mask the token value)
    auth_value = auth_headers.get("Authorization", "")
    if auth_value.startswith("Bearer "):
        token_preview = auth_value[7:17] + "..." + auth_value[-4:]
        print(f">>> Authenticated: Bearer {token_preview}", file=sys.stderr)
    else:
        print(f">>> Authenticated: {list(auth_headers.keys())}", file=sys.stderr)
    print(f">>> Workspace: {workspace_host}", file=sys.stderr)

    # --- Request ---
    url = f"{workspace_host}/serving-endpoints/{args.endpoint}/invocations"
    payload = {"input": [{"role": "user", "content": message}]}

    print(f">>> POST {url}")
    print(f">>> Payload: {json.dumps(payload, ensure_ascii=False)}")
    print()

    resp = requests.post(
        url,
        headers={**auth_headers, "Content-Type": "application/json"},
        json=payload,
        timeout=120,
    )

    # --- Response headers ---
    print(f"HTTP/{resp.raw.version / 10:.1f} {resp.status_code} {resp.reason}")
    for key, value in resp.headers.items():
        print(f"{key}: {value}")
    print()

    # --- Response body ---
    try:
        body = resp.json()
        print(json.dumps(body, indent=2, ensure_ascii=False))
    except ValueError:
        print(resp.text)


if __name__ == "__main__":
    main()
