###############################################################################
# Knowledge Assistant Agent - GEEC Contratación Pública
# The agent model serving endpoint is created by notebook 02_create_agent
# via agents.deploy() which handles model registration and deployment.
###############################################################################

###############################################################################
# Notebook: Parse PDFs, Chunk, and Populate doc_chunks Table
###############################################################################

resource "databricks_notebook" "parse_documents" {
  path     = "/Workspace/Users/${var.workspace_user}/geec_assistant/01_parse_documents"
  language = "PYTHON"
  content_base64 = base64encode(<<-PYTHON
# Databricks notebook source
# MAGIC %md
# MAGIC # GEEC Document Parser
# MAGIC Parses PDF documents from the volume, chunks them, and populates the doc_chunks table
# MAGIC for vector search indexing.

# COMMAND ----------

import uuid
from pyspark.sql import functions as F
from pyspark.sql.types import StructType, StructField, StringType, IntegerType

catalog = "${var.catalog_name}"
schema = "${var.schema_name}"
volume = "${var.volume_name}"

volume_path = f"/Volumes/{catalog}/{schema}/{volume}"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Parse PDFs using ai_parse_document

# COMMAND ----------

df_files = spark.sql(f"""
  SELECT
    path,
    regexp_extract(path, '[^/]+$') AS doc_name
  FROM list_files('{volume_path}', recurse => true)
  WHERE path LIKE '%.pdf'
""")

display(df_files)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Parse document content

# COMMAND ----------

df_parsed = spark.sql(f"""
  SELECT
    path AS doc_path,
    regexp_extract(path, '[^/]+$') AS doc_name,
    ai_parse_document(path, 'text') AS content
  FROM list_files('{volume_path}', recurse => true)
  WHERE path LIKE '%.pdf'
""")

display(df_parsed)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Chunk documents

# COMMAND ----------

from pyspark.sql.functions import udf, explode, lit
from pyspark.sql.types import ArrayType

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200

@udf(returnType=ArrayType(StringType()))
def chunk_text(text):
    if not text:
        return []
    chunks = []
    start = 0
    while start < len(text):
        end = start + CHUNK_SIZE
        chunk = text[start:end]
        if chunk.strip():
            chunks.append(chunk.strip())
        start += CHUNK_SIZE - CHUNK_OVERLAP
    return chunks

df_chunks = (
    df_parsed
    .withColumn("chunks", chunk_text("content"))
    .withColumn("chunk_with_index", explode(
        F.transform("chunks", lambda x, i: F.struct(x.alias("text"), i.alias("idx")))
    ))
    .select(
        F.expr("uuid()").alias("chunk_id"),
        "doc_path",
        "doc_name",
        F.col("chunk_with_index.text").alias("content"),
        F.col("chunk_with_index.idx").cast("int").alias("chunk_index"),
    )
)

display(df_chunks)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Write to doc_chunks table

# COMMAND ----------

target_table = f"{catalog}.{schema}.doc_chunks"

df_chunks.write.mode("overwrite").saveAsTable(target_table)

print(f"Written {{df_chunks.count()}} chunks to {{target_table}}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Trigger vector search index sync

# COMMAND ----------

from databricks.sdk import WorkspaceClient

w = WorkspaceClient()
w.vector_search_indexes.sync_index(
    index_name=f"{catalog}.{schema}.doc_chunks_index"
)

print("Vector search index sync triggered.")
PYTHON
  )
}

###############################################################################
# Notebook: Create and Register the Knowledge Assistant Agent
###############################################################################

resource "databricks_notebook" "create_agent" {
  path     = "/Workspace/Users/${var.workspace_user}/geec_assistant/02_create_agent"
  language = "PYTHON"
  content_base64 = base64encode(<<-PYTHON
# Databricks notebook source
# MAGIC %md
# MAGIC # GEEC Knowledge Assistant Agent
# MAGIC Creates a RAG-based knowledge assistant for the GEEC procurement system.
# MAGIC
# MAGIC ## Purpose (from Proposito_contract_assistant.md)
# MAGIC The GEEC (Gestor d'Expedients Electrònics de Contractació) is the corporate tool
# MAGIC for electronically processing and managing all public procurement files of the
# MAGIC Generalitat de Catalunya. This agent helps users navigate GEEC documentation,
# MAGIC procedures, and regulations.

# COMMAND ----------

# MAGIC %pip install databricks-agents mlflow

# COMMAND ----------

# MAGIC %restart_python

# COMMAND ----------

import mlflow
from databricks import agents

catalog = "${var.catalog_name}"
schema = "${var.schema_name}"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Define the Agent

# COMMAND ----------

from databricks.agents.udfs import ChatCompletionAgent

SYSTEM_PROMPT = """${local.geec_system_prompt}"""

# COMMAND ----------

# MAGIC %md
# MAGIC ## Configure retriever tool (Vector Search)

# COMMAND ----------

from databricks.agents.udfs import VectorSearchRetrieverTool

retriever = VectorSearchRetrieverTool(
    index_name=f"{catalog}.{schema}.doc_chunks_index",
    tool_name="geec_doc_search",
    tool_description=(
        "Busca en la documentación oficial de la GEEC: guías de soporte, manuales de usuario "
        "(nivel inicial y medio), normativa BOE sobre contratación pública (LCSP), y guías "
        "específicas de procedimientos (contratos menores, procedimiento abierto, negociado, "
        "restringido, prórrogas, modificaciones, liquidaciones, acuerdos marco, etc.)."
    ),
    columns=["chunk_id", "doc_name", "content", "chunk_index"],
    num_results=10,
    filters_json=None,
)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Build and register the agent

# COMMAND ----------

agent = ChatCompletionAgent(
    model="databricks-claude-sonnet-4",
    system_prompt=SYSTEM_PROMPT,
    tools=[retriever],
)

mlflow.set_registry_uri("databricks-uc")

with mlflow.start_run(run_name="geec_knowledge_assistant"):
    model_info = mlflow.pyfunc.log_model(
        artifact_path="agent",
        python_model=agent,
        registered_model_name=f"{catalog}.{schema}.geec_knowledge_assistant",
        pip_requirements=[
            "databricks-agents",
            "mlflow",
        ],
    )

print(f"Agent registered: {catalog}.{schema}.geec_knowledge_assistant")
print(f"Model URI: {model_info.model_uri}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Deploy the agent endpoint

# COMMAND ----------

agents.deploy(
    model_name=f"{catalog}.{schema}.geec_knowledge_assistant",
    model_version=model_info.registered_model_version,
    endpoint_name="${var.agent_endpoint_name}",
)

print(f"Agent deployed to endpoint: ${var.agent_endpoint_name}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Quick test

# COMMAND ----------

from databricks.sdk import WorkspaceClient

w = WorkspaceClient()

response = agent.predict(
    {
        "messages": [
            {"role": "user", "content": "¿Qué es la GEEC y para qué sirve?"}
        ]
    }
)

print(response)
PYTHON
  )
}

###############################################################################
# Job: Orchestrate document parsing and agent creation
###############################################################################

resource "databricks_job" "setup_agent" {
  name = "GEEC Knowledge Assistant - Setup"

  task {
    task_key = "parse_documents"

    notebook_task {
      notebook_path = databricks_notebook.parse_documents.path
    }

    new_cluster {
      num_workers   = 0
      spark_version = "15.4.x-scala2.12"
      node_type_id  = "Standard_DS3_v2"

      spark_conf = {
        "spark.databricks.cluster.profile" = "singleNode"
        "spark.master"                     = "local[*]"
      }

      custom_tags = {
        "ResourceClass" = "SingleNode"
      }
    }
  }

  task {
    task_key = "create_agent"

    depends_on {
      task_key = "parse_documents"
    }

    notebook_task {
      notebook_path = databricks_notebook.create_agent.path
    }

    new_cluster {
      num_workers   = 0
      spark_version = "15.4.x-scala2.12"
      node_type_id  = "Standard_DS3_v2"

      spark_conf = {
        "spark.databricks.cluster.profile" = "singleNode"
        "spark.master"                     = "local[*]"
      }

      custom_tags = {
        "ResourceClass" = "SingleNode"
      }
    }
  }

  depends_on = [
    databricks_notebook.parse_documents,
    databricks_notebook.create_agent,
    databricks_vector_search_index.doc_index,
  ]
}
