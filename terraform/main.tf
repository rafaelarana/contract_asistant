###############################################################################
# Unity Catalog: Schema + Volume + Document Upload
###############################################################################

resource "databricks_schema" "asistente" {
  catalog_name = var.catalog_name
  name         = var.schema_name
  comment      = "Schema para el asistente de contratación pública GEEC"

  properties = {
    purpose = "knowledge_assistant"
    source  = "GEEC - Generalitat de Catalunya"
  }
}

resource "databricks_volume" "doc" {
  catalog_name = var.catalog_name
  schema_name  = databricks_schema.asistente.name
  name         = var.volume_name
  volume_type  = "MANAGED"
  comment      = "Documentación GEEC: guías de soporte, manuales y normativa BOE"
}

# ---------------------------------------------------------------------------
# Upload all PDF documents from each subfolder to the volume
# ---------------------------------------------------------------------------

locals {
  doc_files = fileset(var.docs_path, "**/*.pdf")
}

resource "databricks_file" "docs" {
  for_each = local.doc_files

  source = "${var.docs_path}/${each.value}"
  path   = "/Volumes/${var.catalog_name}/${var.schema_name}/${var.volume_name}/${each.value}"

  depends_on = [databricks_volume.doc]
}

###############################################################################
# Vector Search: Endpoint + Parsed Documents Table + Index
###############################################################################

resource "databricks_vector_search_endpoint" "geec" {
  name          = var.vector_search_endpoint_name
  endpoint_type = "STANDARD"
}

# Table to store parsed and chunked document content for vector indexing
resource "databricks_sql_table" "doc_chunks" {
  catalog_name = var.catalog_name
  schema_name  = databricks_schema.asistente.name
  name         = "doc_chunks"
  table_type   = "MANAGED"
  comment      = "Parsed and chunked document content from GEEC PDFs for RAG"

  data_source_format = "DELTA"

  properties = {
    "delta.enableChangeDataFeed" = "true"
  }

  column {
    name    = "chunk_id"
    type    = "STRING"
    comment = "Unique identifier for each chunk"
  }
  column {
    name    = "doc_path"
    type    = "STRING"
    comment = "Source document path in the volume"
  }
  column {
    name    = "doc_name"
    type    = "STRING"
    comment = "Source document filename"
  }
  column {
    name    = "content"
    type    = "STRING"
    comment = "Text content of the chunk"
  }
  column {
    name    = "chunk_index"
    type    = "INT"
    comment = "Position index of the chunk within the document"
  }

  depends_on = [databricks_schema.asistente]
}

resource "databricks_vector_search_index" "doc_index" {
  name          = "${var.catalog_name}.${var.schema_name}.doc_chunks_index"
  endpoint_name = databricks_vector_search_endpoint.geec.name
  index_type    = "DELTA_SYNC"

  primary_key = "chunk_id"

  delta_sync_index_spec {
    source_table  = "${var.catalog_name}.${var.schema_name}.doc_chunks"
    pipeline_type = "TRIGGERED"
    embedding_source_columns {
      name                          = "content"
      embedding_model_endpoint_name = "databricks-gte-large-en"
    }
  }

  timeouts {
    create = "60m"
  }

  depends_on = [
    databricks_sql_table.doc_chunks,
    databricks_vector_search_endpoint.geec
  ]
}
