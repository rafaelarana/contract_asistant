# Contract Assistant

A conversational **contract assistant** for the **Gestor Electronic d'Expedients de Contractacio** — an electronic procurement management system for public-sector contracting. Users can ask questions about public contracting procedures, regulations, and workflows in Catalan or Spanish, and get answers grounded in official documentation with inline citations.

Built as a full-stack [Databricks App](https://docs.databricks.com/en/dev-tools/databricks-apps/index.html) using the [`apx`](https://github.com/databricks-solutions/apx) framework, with infrastructure managed by Terraform.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Databricks App                           │
│  ┌──────────────┐    ┌──────────────────────────────────────┐   │
│  │  React UI    │───▶│  FastAPI Backend (/api)               │   │
│  │  (Vite)      │    │                                      │   │
│  │  - Chat      │    │  POST /chat ──▶ Knowledge Assistant  │   │
│  │  - Citations  │    │  GET  /conversations                 │   │
│  │  - Doc viewer │    │  GET  /document ──▶ UC Volume proxy  │   │
│  │  - Feedback   │    │  POST /feedback ──▶ MLflow           │   │
│  └──────────────┘    └───────────┬──────────────────────────┘   │
│                                  │                               │
└──────────────────────────────────┼───────────────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
┌──────────────────┐  ┌─────────────────────┐  ┌──────────────────┐
│  Knowledge       │  │  Lakebase           │  │  MLflow          │
│  Assistant       │  │  (PostgreSQL)       │  │  Experiment      │
│  Endpoint        │  │                     │  │                  │
│  - Claude Sonnet │  │  - conversations    │  │  - Traces        │
│  - Vector Search │  │  - messages         │  │  - User feedback │
│  - RAG pipeline  │  │  - citations (JSONB)│  │                  │
└────────┬─────────┘  └─────────────────────┘  └──────────────────┘
         │
         ▼
┌──────────────────┐
│  Vector Search   │
│  Index           │
│                  │
│  doc_chunks_index│
│  (gte-large-en)  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  UC Volume       │
│  /Volumes/       │
│  catalog/schema/ │
│  doc/            │
│  - BOE PDFs      │
│  - Manuals       │
│  - Support guides│
└──────────────────┘
```

### Components

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Frontend** | React 19, TanStack Router/Query, shadcn/ui | Chat UI with sidebar, document viewer panel, citation tooltips |
| **Backend** | FastAPI, Uvicorn (2 workers) | API routes, KA proxy, document proxy, feedback |
| **Knowledge Assistant** | Databricks KA (Claude Sonnet + Vector Search) | RAG-based Q&A over indexed contracting documentation |
| **Vector Search** | Databricks Vector Search (gte-large-en) | Semantic search over document chunks |
| **Chat Memory** | Lakebase (PostgreSQL) | Conversation history with citation metadata (JSONB) |
| **Observability** | MLflow | Request tracing, user feedback collection |
| **Infrastructure** | Terraform | UC schema, volume, vector search, agent, Lakebase |
| **Build/Deploy** | apx + Databricks Asset Bundles (DAB) | Build, bundle, and deploy to Databricks Apps |

## Project Structure

```
contract_assistant/
├── Makefile                      # Orchestrates build / render / deploy / run
├── app/                          # Full-stack Databricks App
│   ├── src/geec_assistant/
│   │   ├── backend/
│   │   │   ├── app.py            # FastAPI application entry
│   │   │   ├── router.py         # API routes (chat, conversations, documents, feedback)
│   │   │   ├── models.py         # Pydantic request/response models
│   │   │   ├── db.py             # Lakebase PostgreSQL functions
│   │   │   └── core/             # DI framework, config, static serving
│   │   └── ui/
│   │       ├── routes/index.tsx  # Main chat UI
│   │       ├── lib/api.ts        # Auto-generated OpenAPI client
│   │       ├── lib/i18n.ts       # Catalan/Spanish translations
│   │       └── components/       # shadcn/ui + custom components
│   ├── pyproject.toml            # Python dependencies & apx config
│   ├── package.json              # Node.js dependencies
│   ├── app.yaml                  # Databricks Apps manifest (template w/ ${VAR})
│   ├── databricks.yml.tpl        # Asset Bundle template — rendered on deploy
│   ├── databricks.yml            # Rendered bundle config (gitignored)
│   └── .env                      # Rendered local-dev env (gitignored)
├── terraform/                    # Infrastructure as Code
│   ├── main.tf                   # UC schema, volume, vector search index
│   ├── agent.tf                  # Code-based RAG agent notebooks & job
│   ├── knowledge_assistant.tf    # Agent Bricks KA reconciler (external data)
│   ├── lakebase.tf               # Lakebase PostgreSQL project + endpoint lookup
│   ├── prompts.tf                # Shared system prompt local
│   ├── prompts/geec_system_prompt.txt  # Spanish/Catalan system prompt
│   ├── variables.tf              # Configurable parameters
│   ├── outputs.tf                # Outputs consumed by render-*.sh scripts
│   └── provider.tf               # Databricks provider
├── scripts/                      # Deploy-pipeline helpers
│   ├── render-app-config.sh      # app.yaml -> .build/app.yaml (terraform outputs)
│   ├── render-env.sh             # terraform outputs -> app/.env
│   ├── render-bundle-config.sh   # databricks.yml.tpl -> databricks.yml
│   ├── deploy-bundle.sh          # databricks bundle deploy
│   ├── ka-sync.sh                # Idempotent KA + source reconciler (external)
│   └── lakebase-endpoint.sh      # Resolves Lakebase endpoint hostname
├── docs/                         # Source documentation (PDFs)
│   ├── BOE/                      # Regulatory documents
│   ├── Manual/                   # User manuals
│   └── Moodle_Guies_Suport/     # Training & support guides
└── qa/                           # QA testing scripts
```

## Prerequisites

- Python >= 3.11
- Node.js (with Bun)
- [Databricks CLI](https://docs.databricks.com/en/dev-tools/cli/index.html) configured with a profile
- [apx CLI](https://github.com/databricks-solutions/apx)
- [Terraform](https://www.terraform.io/) >= 1.0
- `jq` and `envsubst` (macOS: `brew install jq gettext`) — used by the render scripts
- Access to a Databricks workspace with Unity Catalog, Vector Search, Lakebase, and Agent Bricks

## Local Development Setup

Runtime config is **not** hand-edited — everything flows from Terraform outputs into `app/.env` (for local dev) and `app/.build/app.yaml` (for deploy). The only thing you configure by hand is the Databricks CLI profile.

### 1. Configure Databricks CLI profile

```bash
databricks configure --profile azure-vm-workspace
```

The profile name is referenced in `terraform/variables.tf` (`databricks_profile`). If you use a different name, override it at plan time: `terraform apply -var=databricks_profile=my-profile`.

### 2. Provision infrastructure (first time only)

```bash
cd terraform
terraform init
terraform apply
```

Creates / reconciles: UC schema, document volume + PDFs, vector search endpoint & index, Lakebase Postgres project + database, Agent Bricks Knowledge Assistant (display name `Contract Assistant` — set `ka_display_name` in `terraform/variables.tf` to match) with a `files` knowledge source pointing at the UC volume, and the code-based RAG agent notebooks & job.

### 3. Install app dependencies

```bash
cd app
uv sync          # Python
apx bun install  # Frontend
```

### 4. Render `.env` from Terraform outputs

From the repo root:

```bash
make render-env
```

This writes `app/.env` with application environment variables sourced from the live Terraform state (KA endpoint name, MLflow experiment path, Lakebase host, etc.). Anything you add below the `# --- local overrides ---` marker is preserved across re-runs.

### 5. Start the dev server

```bash
cd app
apx dev start
```

Starts FastAPI backend, Vite frontend, and the OpenAPI-client watcher. URL is printed in the terminal.

### Other development commands

```bash
apx dev logs        # recent logs
apx dev logs -f     # stream
apx dev check       # TypeScript + Python static checks
apx dev status      # server status
apx dev stop        # stop servers
```

## Deploying to Databricks

Both `app/app.yaml` (runtime env + resources) and `app/databricks.yml` (bundle config) are templated with `${VAR}` placeholders and rendered from `terraform output` at deploy time — no file is hand-edited per workspace.

> `workspace.host` and `workspace.profile` can't use bundle `${var.x}` interpolation (Databricks resolves auth before variable substitution), which is why `app/databricks.yml.tpl` is processed with `envsubst` instead. The rendered `databricks.yml` is gitignored.

### Make targets

From the repo root:

| Target | What it does |
|---|---|
| `make deploy` | Full pipeline: `apx build` → render `app.yaml` + `.env` + `databricks.yml` → `databricks bundle deploy` |
| `make run` | Triggers `databricks bundle run geec-assistant-app` — the workspace pulls the latest artifacts and restarts the app. Prints the public URL. Assumes `make deploy` ran recently |
| `make render-env` | Rewrites `app/.env` from terraform outputs (for `apx dev start`). Preserves content below `# --- local overrides ---` |
| `make render-app-yaml` | Renders only `app/.build/app.yaml` (requires `apx build` first) |
| `make render-bundle` | Renders only `app/databricks.yml` from `databricks.yml.tpl` |
| `make check-tools` | Verifies `terraform`, `jq`, `envsubst`, `databricks`, `apx` are on `PATH` |

Variables:

```bash
make deploy BUNDLE_TARGET=dev   # default; currently the only target defined
```

### Typical flow

```bash
# First time / after terraform changes
terraform -chdir=terraform apply
make deploy    # build, render, upload bundle

# Iterating on app code
make deploy    # re-build + re-upload
make run       # tell the workspace to pick up the new artifacts
```

### Adding a new app config value

1. Add a variable in `terraform/variables.tf` and an output in `terraform/outputs.tf`.
2. Reference it as `${TF_OUTPUT_NAME_UPPERCASED}` in `app/app.yaml` (and/or `.env`, `databricks.yml.tpl`).
3. Add the output name (UPPER_SNAKE_CASE) to the `TF_OUTPUTS` array in the relevant render script (`scripts/render-app-config.sh` for `app.yaml`, `scripts/render-bundle-config.sh` for bundle, `scripts/render-env.sh` already reads all outputs by name).

### Service principal permissions

When the app is created, Databricks assigns it a service principal. Permissions to downstream resources are declared in `app/app.yaml` under the `resources:` block and bound automatically at deploy time — you don't need to grant them manually.

| Resource block | Permission | Purpose |
|---|---|---|
| `ka-serving-endpoint` (`serving_endpoint`) | `CAN_QUERY` | Query the Knowledge Assistant |
| `sql-warehouse` (`sql_warehouse`) | `CAN_USE` | Optional SQL warehouse for future analytics |
| `chat-memory-db` (`database`) | `CAN_CONNECT_AND_CREATE` | Lakebase chat memory (conversations, messages, citations) |
| `doc-volume` (`uc_securable` type `VOLUME`) | `READ_VOLUME` | Serve PDFs to the document viewer |
| `mlflow-experiment` (`uc_securable` type `MLFLOW_EXPERIMENT`) | `CAN_EDIT` | Write traces and feedback |

If you add a new resource your app needs, add a block to `app/app.yaml` and re-run `make deploy`. UC catalog/schema `USE_*` grants are transitively covered by the volume/experiment bindings.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/version` | App version info |
| `GET` | `/api/current-user` | Authenticated user details |
| `POST` | `/api/chat` | Send a message, get an AI response with citations |
| `GET` | `/api/conversations` | List recent conversations |
| `GET` | `/api/conversations/{id}/messages` | Get messages for a conversation |
| `DELETE` | `/api/conversations/{id}` | Delete a conversation |
| `POST` | `/api/feedback` | Submit thumbs-up/down feedback (logged to MLflow) |
| `GET` | `/api/document?url=...` | Proxy to fetch a document from UC Volumes (PDF or text) |

## Terraform Resources

Defaults from `terraform/variables.tf`; override per workspace with `-var=...` or a `.tfvars` file.

| Resource | Default name | Description |
|----------|------|-------------|
| UC Schema | `<catalog>.asistente` | Schema for all contract assistant assets (catalog from `var.catalog_name`) |
| UC Volume | `doc` | Managed volume holding source PDFs |
| Delta Table | `doc_chunks` | Document chunks with text content |
| Vector Search Endpoint | `geec_vs_endpoint` | Hosts the vector search index |
| Vector Search Index | `doc_chunks_index` | Semantic search over chunks (gte-large-en) |
| Lakebase Project | `geec-chat-memory` | Autoscaling Postgres project |
| Lakebase Database | `chat` | Postgres database for chat memory |
| Databricks Job | See `terraform/agent.tf` (`databricks_job`) | Parses documents and deploys the code-based RAG agent |
| Agent Bricks KA | `var.ka_display_name` | Reconciled by `scripts/ka-sync.sh` via an `external` data source |
| Knowledge Source | `var.ka_source_display_name` (type `files`) | Points at the UC volume so the KA auto-ingests the PDFs |
