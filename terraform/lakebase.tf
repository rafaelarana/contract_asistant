###############################################################################
# Lakebase Autoscaling: Chat Memory for GEEC Assistant
###############################################################################

resource "databricks_postgres_project" "chat_memory" {
  project_id = var.lakebase_project_name

  provider_config = {
    workspace_id = var.workspace_id
  }

  initial_endpoint_spec = {
    group = {
      min = 1
      max = 1
    }
  }
}

###############################################################################
# Look up the default role auto-created with the project so we don't hardcode
# a role_id that only exists in one workspace.
###############################################################################

data "databricks_postgres_roles" "chat_memory_roles" {
  parent = "${databricks_postgres_project.chat_memory.name}/branches/production"

  provider_config = {
    workspace_id = var.workspace_id
  }

  depends_on = [databricks_postgres_project.chat_memory]
}

locals {
  chat_memory_default_role = try(
    [for r in data.databricks_postgres_roles.chat_memory_roles.roles : r.name if try(r.spec.owner, false)][0],
    data.databricks_postgres_roles.chat_memory_roles.roles[0].name,
  )
}

resource "databricks_postgres_database" "chat_db" {
  parent      = "${databricks_postgres_project.chat_memory.name}/branches/production"
  database_id = "chat"

  spec = {
    postgres_database = "chat"
    role              = local.chat_memory_default_role
  }

  provider_config = {
    workspace_id = var.workspace_id
  }

  depends_on = [databricks_postgres_project.chat_memory]
}

###############################################################################
# Resolve the primary endpoint hostname dynamically. The provider doesn't
# expose a data source for endpoints yet, so we shell out to the CLI — same
# pattern as scripts/ka-sync.sh.
###############################################################################

data "external" "lakebase_endpoint" {
  program = ["${path.module}/../scripts/lakebase-endpoint.sh"]

  query = {
    endpoint_name = "${databricks_postgres_project.chat_memory.name}/branches/production/endpoints/primary"
    profile       = var.databricks_profile
  }

  depends_on = [databricks_postgres_project.chat_memory]
}
