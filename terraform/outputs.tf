output "schema_full_name" {
  description = "Full name of the created schema"
  value       = "${var.catalog_name}.${databricks_schema.asistente.name}"
}

output "volume_path" {
  description = "Path to the documents volume"
  value       = "/Volumes/${var.catalog_name}/${var.schema_name}/${var.volume_name}"
}

output "documents_uploaded" {
  description = "Number of documents uploaded to the volume"
  value       = length(databricks_file.docs)
}

output "vector_search_endpoint" {
  description = "Vector search endpoint name"
  value       = databricks_vector_search_endpoint.geec.name
}

output "vector_search_index" {
  description = "Vector search index full name"
  value       = databricks_vector_search_index.doc_index.name
}

output "uc_volume_full_name" {
  description = "Three-part UC name of the documents volume (catalog.schema.volume)"
  value       = "${var.catalog_name}.${databricks_schema.asistente.name}.${databricks_volume.doc.name}"
}

output "lakebase_instance_name" {
  description = "Lakebase instance (project) name used by the Databricks App database resource"
  value       = var.lakebase_project_name
}

output "agent_setup_job_url" {
  description = "URL of the job that parses documents and deploys the agent"
  value       = databricks_job.setup_agent.url
}

output "lakebase_project" {
  description = "Lakebase Autoscaling project name"
  value       = databricks_postgres_project.chat_memory.name
}

output "lakebase_database" {
  description = "Lakebase database for chat memory"
  value       = databricks_postgres_database.chat_db.name
}

# ---------------------------------------------------------------------------
# App runtime configuration
# Consumed by `make deploy` to render app/app.yaml placeholders into
# app/.build/app.yaml at deploy time.
# ---------------------------------------------------------------------------

output "ka_endpoint_name" {
  description = "Knowledge Assistant serving endpoint name"
  value       = data.external.ka.result.endpoint_name
}

output "ka_name" {
  description = "Full KA resource name (knowledge-assistants/{id})"
  value       = data.external.ka.result.ka_name
}

output "mlflow_experiment_path" {
  description = "MLflow experiment path used by the KA agent"
  value       = data.external.ka.result.experiment_path
}

output "mlflow_experiment_id" {
  description = "MLflow experiment ID used by the KA agent"
  value       = data.external.ka.result.experiment_id
}

output "lakebase_host" {
  description = "Lakebase Postgres endpoint hostname"
  value       = data.external.lakebase_endpoint.result.host
}

output "lakebase_database_name" {
  description = "Lakebase database name"
  value       = var.lakebase_database_name
}

output "lakebase_endpoint_path" {
  description = "Lakebase auth endpoint path"
  value       = var.lakebase_endpoint_path
}

output "workspace_host" {
  description = "Databricks workspace host URL"
  value       = var.workspace_host
}

output "databricks_profile" {
  description = "Databricks CLI profile used to authenticate"
  value       = var.databricks_profile
}
