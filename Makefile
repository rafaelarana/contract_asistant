.PHONY: deploy run render-app-yaml render-env render-bundle check-tools

BUNDLE_TARGET ?= dev

check-tools:
	@command -v terraform >/dev/null || { echo "terraform not found"; exit 1; }
	@command -v jq >/dev/null || { echo "jq not found"; exit 1; }
	@command -v envsubst >/dev/null || { echo "envsubst not found (install gettext)"; exit 1; }
	@command -v databricks >/dev/null || { echo "databricks CLI not found"; exit 1; }
	@command -v apx >/dev/null || { echo "apx not found"; exit 1; }

# Render app/app.yaml placeholders into app/.build/app.yaml from terraform outputs.
render-app-yaml: check-tools
	./scripts/render-app-config.sh

# Render app/.env from terraform outputs for local `apx dev`.
render-env: check-tools
	./scripts/render-env.sh

# Render app/databricks.yml from the template using terraform outputs.
render-bundle: check-tools
	./scripts/render-bundle-config.sh

# Full deploy: build frontend, render app.yaml + databricks.yml, push bundle.
# The grant-app-postgres-role step reconciles a Lakebase Autoscaling role for
# the app SP — runs last because it needs the SP created by `bundle deploy`.
deploy: check-tools
	cd app && apx build
	./scripts/render-app-config.sh
	./scripts/render-env.sh
	./scripts/render-bundle-config.sh
	./scripts/deploy-bundle.sh $(BUNDLE_TARGET)
	./scripts/grant-app-postgres-role.sh
	./scripts/grant-app-mlflow-edit.sh

# Trigger the app to pick up the latest bundle artifacts in the workspace.
# Assumes `make deploy` was run recently. Streams until the app reports
# RUNNING and prints the public URL.
run: check-tools
	cd app && databricks bundle run geec-assistant-app -t $(BUNDLE_TARGET)
