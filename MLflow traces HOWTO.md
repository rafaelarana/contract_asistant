# MLflow traces — HOWTO

This document explains how **MLflow traces** are created, configured, and linked to user feedback in the Contract Assistant app.

## Configuration

The experiment path is loaded from app settings. The environment variable prefix matches the app slug in uppercase (for example `GEEC_ASSISTANT_`), and the field is `mlflow_experiment`:

```35:36:app/src/geec_assistant/backend/core/_config.py
    # MLflow
    mlflow_experiment: str = Field(default="/Users/rafael.arana@databricks.com/ka-6c652faf-dev-experiment")
```

At deploy time, `GEEC_ASSISTANT_MLFLOW_EXPERIMENT` is populated from Terraform (`mlflow_experiment_path` in `terraform/outputs.tf`, written by `scripts/render-env.sh` and referenced in `app/app.yaml` as `${MLFLOW_EXPERIMENT_PATH}`).

## Lazy initialization (Databricks tracking)

MLflow is initialized on first use. The app sets the tracking URI to Databricks, selects the experiment, disables autolog, and keeps an `MlflowClient`. If initialization fails, chat still works but **tracing and feedback logging are skipped**.

```38:53:app/src/geec_assistant/backend/router.py
def _init_mlflow(config: AppConfig):
    global _mlflow_client, _mlflow_available
    if _mlflow_available:
        return
    try:
        import mlflow

        mlflow.set_tracking_uri("databricks")
        mlflow.set_experiment(config.mlflow_experiment)
        mlflow.autolog(disable=True)
        _mlflow_client = mlflow.MlflowClient()
        _mlflow_available = True
        logger.info("MLflow initialized successfully.")
    except Exception as e:
        _mlflow_available = False
        logger.warning(f"MLflow not available, feedback disabled: {e}")
```

## One trace per chat turn (`POST /api/chat`)

The chat handler calls `_query_agent_traced`, which wraps the Knowledge Assistant request in an MLflow span named `geec_chat`. That span is the trace root for the turn.

```56:86:app/src/geec_assistant/backend/router.py
def _query_agent_traced(ws, config: AppConfig, user_message: str, messages: list[dict], user_email: str | None = None) -> tuple[str, str | None, list[Citation]]:
    ...
    if _mlflow_available:
        import mlflow

        return _query_with_tracing(ws, config, user_message, messages, mlflow, user_email)
    else:
        content, citations = _query_agent(ws, config, messages)
        return content, None, citations


def _query_with_tracing(ws, config: AppConfig, user_message: str, messages: list[dict], mlflow, user_email: str | None) -> tuple[str, str | None, list[Citation]]:
    """Query agent inside an MLflow tracing span."""
    with mlflow.start_span(name="geec_chat") as span:
        span.set_inputs({"user_message": user_message, "history_len": len(messages)})
        trace_id = span.request_id
        if user_email:
            try:
                # `mlflow.trace.user` populates the "User" column in the Traces UI;
                # the `user_email` tag makes traces filterable by user.
                mlflow.update_current_trace(
                    metadata={"mlflow.trace.user": user_email},
                    tags={"user_email": user_email},
                )
            except Exception as e:
                logger.warning(f"Could not attach user metadata to trace: {e}")
        content, citations = _query_agent(ws, config, messages)
        span.set_outputs({"response": content[:200]})
        return content, trace_id, citations
```

What gets recorded:

| Piece | Meaning |
|--------|--------|
| **Span name** | `geec_chat` |
| **Inputs** | `user_message`, `history_len` (history length) |
| **Outputs** | First 200 characters of the assistant reply |
| **`trace_id`** | `span.request_id` — returned to the client for feedback |

The Knowledge Assistant itself is invoked inside `_query_agent` via HTTP (`POST …/serving-endpoints/{ka_endpoint}/invocations`). MLflow does not automatically break that call into child spans; the explicit `geec_chat` span is the main trace boundary unless you add more spans.

## API response and frontend

`ChatOut` includes an optional `trace_id`. The chat route returns it after each successful turn:

```239:244:app/src/geec_assistant/backend/router.py
    return ChatOut(
        conversation_id=conversation_id,
        response=assistant_response,
        trace_id=trace_id,
        citations=citations,
    )
```

The UI (`app/src/geec_assistant/ui/routes/index.tsx`) stores `trace_id` per assistant message and passes it to `POST /api/feedback` when the user submits thumbs up/down.

## Feedback on a trace (`POST /api/feedback`)

After ensuring MLflow is initialized, feedback is attached to the trace with `mlflow.log_feedback` (MLflow 3 GenAI assessments):

```150:167:app/src/geec_assistant/backend/router.py
def _submit_feedback(trace_id: str, is_positive: bool, comment: str = "", user_email: str | None = None) -> bool:
    if not _mlflow_available:
        return False
    try:
        import mlflow
        from mlflow.entities import AssessmentSource

        mlflow.log_feedback(
            trace_id=trace_id,
            name="user_feedback",
            source=AssessmentSource(source_type="HUMAN", source_id=user_email or "web_user"),
            value="positive" if is_positive else "negative",
            rationale=comment or ("User liked this response" if is_positive else "User disliked this response"),
        )
        return True
    except Exception as e:
        logger.warning(f"Could not log feedback: {e}")
        return False
```

## Lakebase vs MLflow

Conversation text and citation metadata are stored in **Lakebase** (Postgres) via `db.save_message`. The **`trace_id` is not persisted there** in the current flow; it is returned on the chat response and kept in the client for feedback. Traces and assessments live in **MLflow** on Databricks for the configured experiment.

## Summary

1. **Experiment** — `mlflow_experiment` / `GEEC_ASSISTANT_MLFLOW_EXPERIMENT`.
2. **Tracking** — `databricks` URI + `set_experiment`; autolog off.
3. **Trace** — one `geec_chat` span per `/api/chat` turn; `trace_id = span.request_id`.
4. **User** — optional `mlflow.update_current_trace` metadata/tags from request headers.
5. **Feedback** — `mlflow.log_feedback` with that `trace_id` from `/api/feedback`.

Dependency: `mlflow` in `app/pyproject.toml` (includes MLflow tracing support used by the Databricks workspace).
