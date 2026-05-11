bundle:
  name: geec-assistant

sync:
  include:
    - .build

# `apx build` is run explicitly by the Makefile before `databricks bundle
# deploy`; we don't declare an `artifacts` block here because the bundle's
# artifact build would re-run apx build and overwrite the rendered
# .build/app.yaml (resources + env vars) with a minimal one.

resources:
  apps:
    geec-assistant-app:
      name: "geec-assistant"
      description: "geec-assistant created with apx"
      source_code_path: ./.build
      # These resource bindings grant the app's service principal access to
      # downstream resources at bundle-deploy time. Declaring them here (not
      # in app.yaml) is what causes the bundle deployer to patch the app and
      # issue the permission grants.
      resources:
        - name: ka-serving-endpoint
          serving_endpoint:
            name: ${KA_ENDPOINT_NAME}
            permission: CAN_QUERY
        # Chat memory uses Lakebase Autoscaling Projects (not Database
        # Instances), which aren't bindable via bundle `database:` resources.
        # The app SP accesses it through /api/2.0/postgres/credentials.
        - name: doc-volume
          uc_securable:
            securable_full_name: ${UC_VOLUME_FULL_NAME}
            securable_type: VOLUME
            permission: READ_VOLUME

# This file is a template. workspace.host and workspace.profile must be literal
# values because Databricks bundle resolves auth before ${var.x} interpolation,
# so they are filled in at deploy time by scripts/render-bundle-config.sh from
# `terraform output`. The rendered databricks.yml is gitignored.
targets:
  dev:
    mode: development
    default: true
    workspace:
      host: ${WORKSPACE_HOST}
      profile: ${DATABRICKS_PROFILE}
