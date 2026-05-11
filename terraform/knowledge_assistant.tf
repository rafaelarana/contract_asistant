###############################################################################
# Agent Bricks Knowledge Assistant
#
# The Databricks Terraform provider (v1.112.0) has no native resource for
# Knowledge Assistants, so we drive the `databricks knowledge-assistants`
# CLI via an external data source backed by scripts/ka-sync.sh.
#
# The script is idempotent (list-then-create), so running plan/apply
# repeatedly is safe.
###############################################################################

data "external" "ka" {
  program = ["${path.module}/../scripts/ka-sync.sh"]

  query = {
    display_name        = var.ka_display_name
    description         = var.ka_description
    instructions        = local.geec_system_prompt
    source_display_name = var.ka_source_display_name
    source_description  = var.ka_source_description
    volume_path         = "/Volumes/${var.catalog_name}/${var.schema_name}/${var.volume_name}"
    profile             = var.databricks_profile
  }

  # Wait for the volume + all doc uploads so the first sync has content.
  depends_on = [
    databricks_volume.doc,
    databricks_file.docs,
  ]
}
