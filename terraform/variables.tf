variable "catalog_name" {
  description = "Unity Catalog name where the schema will be created"
  type        = string
  default     = "classic_stable_89j9qf"
}

variable "schema_name" {
  description = "Schema name to create"
  type        = string
  default     = "asistente"
}

variable "volume_name" {
  description = "Volume name for documents"
  type        = string
  default     = "doc"
}

variable "docs_path" {
  description = "Local path to the documents folder"
  type        = string
  default     = "../docs"
}

variable "vector_search_endpoint_name" {
  description = "Name of the vector search endpoint"
  type        = string
  default     = "geec_vs_endpoint"
}

variable "agent_endpoint_name" {
  description = "Name of the model serving endpoint for the agent"
  type        = string
  default     = "geec_knowledge_assistant"
}

variable "workspace_user" {
  description = "Databricks workspace username for notebook path"
  type        = string
  default     = "rafael.arana@databricks.com"
}

variable "lakebase_project_name" {
  description = "Name of the Lakebase Autoscaling project for chat memory"
  type        = string
  default     = "geec-chat-memory"
}

variable "databricks_profile" {
  description = "Databricks CLI profile used by helper scripts (must match provider profile)"
  type        = string
  default     = "azure-vm-workspace"
}

variable "ka_display_name" {
  description = "Display name of the Agent Bricks Knowledge Assistant (unique per workspace)"
  type        = string
  default     = "GEEC Contract Assistant"
}

variable "ka_description" {
  description = "User-facing description shown in the Agent Bricks UI"
  type        = string
  default     = "Asistente de la GEEC: procedimientos, manuales y normativa de contratación pública de la Generalitat de Catalunya."
}

variable "ka_source_display_name" {
  description = "Display name of the Knowledge Source attached to the KA"
  type        = string
  default     = "GEEC Docs Volume"
}

variable "ka_source_description" {
  description = "Description of the Knowledge Source"
  type        = string
  default     = "Documentos oficiales de la GEEC: guías de soporte, manuales, normativa BOE (LCSP) y procedimientos."
}

variable "lakebase_database_name" {
  description = "Database name inside the Lakebase project"
  type        = string
  default     = "chat"
}

variable "lakebase_endpoint_path" {
  description = "Lakebase auth endpoint path (projects/<proj>/branches/<branch>/endpoints/<ep>)"
  type        = string
  default     = "projects/geec-chat-memory/branches/production/endpoints/primary"
}

variable "workspace_host" {
  description = "Databricks workspace host URL used by the bundle target"
  type        = string
  default     = "https://adb-7405604561430667.7.azuredatabricks.net/"
}

variable "workspace_id" {
  description = "Databricks workspace numeric ID (must match the one the provider is configured for)"
  type        = string
  default     = "7405604561430667"
}
