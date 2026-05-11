from __future__ import annotations

import base64
import json
import logging
import mimetypes
from urllib.parse import urlparse, unquote

from databricks.sdk.service.iam import User as UserOut

from .core import Dependencies, create_router
from .core._config import AppConfig
from .core._headers import HeadersDependency
from .models import (
    ChatIn,
    ChatOut,
    Citation,
    ConversationListOut,
    DocumentOut,
    ConversationOut,
    FeedbackIn,
    FeedbackOut,
    MessageOut,
    VersionOut,
)
from . import db

logger = logging.getLogger(__name__)

router = create_router()

# --- MLflow helpers ---

_mlflow_client = None
_mlflow_available = False


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


def _query_agent_traced(ws, config: AppConfig, user_message: str, messages: list[dict], user_email: str | None = None) -> tuple[str, str | None, list[Citation]]:
    """Query the Knowledge Assistant agent with optional MLflow tracing."""
    _init_mlflow(config)

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


def _query_agent(ws, config: AppConfig, messages: list[dict]) -> tuple[str, list[Citation]]:
    """Query the Knowledge Assistant serving endpoint. Returns (text, citations)."""
    try:
        input_messages = [{"role": m["role"], "content": m["content"]} for m in messages]
        # Use raw REST API since the SDK doesn't parse KA responses correctly
        import requests
        headers = ws.config.authenticate()
        url = f"{ws.config.host}/serving-endpoints/{config.ka_endpoint}/invocations"
        payload = {"input": input_messages}
        resp = requests.post(url, headers=headers, json=payload, timeout=120)
        resp.raise_for_status()
        raw = resp.json()
        logger.info(f"KA raw response: {json.dumps(raw, ensure_ascii=False, default=str)[:3000]}")

        # KA endpoints return output[].content[].text with annotations for citations
        # We insert inline markers like [1] after cited text so the frontend can
        # render them as clickable superscript links.
        if raw.get("output"):
            texts = []
            seen_urls: dict[str, int] = {}  # url -> citation index (1-based)
            citations: list[Citation] = []
            for item in raw["output"]:
                if item.get("type") == "message" and item.get("content"):
                    for block in item["content"]:
                        block_text = block.get("text", "")
                        annotations = block.get("annotations", [])
                        # If this block has citations, append marker(s) after the text
                        citation_markers = []
                        for ann in annotations:
                            if ann.get("type") == "url_citation" and ann.get("url"):
                                import re as _re
                                ann_url = ann["url"]
                                base_url = ann_url.split("#")[0]
                                if base_url not in seen_urls:
                                    idx = len(citations) + 1
                                    seen_urls[base_url] = idx
                                    # Extract page from fragment
                                    _page_match = _re.search(r"page=(\d+)", ann_url)
                                    _page = int(_page_match.group(1)) if _page_match else None
                                    citations.append(Citation(
                                        title=ann.get("title", ""),
                                        url=ann_url,
                                        page=_page,
                                    ))
                                citation_markers.append(str(seen_urls[base_url]))
                        if block_text:
                            texts.append(block_text)
                        if citation_markers:
                            # Insert markers like [1] or [1][3] right after the text
                            markers = "".join(f"[{m}]" for m in citation_markers)
                            texts.append(markers)
            content = "".join(texts).strip() if texts else str(raw)
            return content, citations
        elif raw.get("choices"):
            return raw["choices"][0]["message"]["content"], []
        else:
            return str(raw), []
    except Exception as e:
        return f"Error al consultar el asistente: {e}", []


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


# --- DB schema bootstrap ---

_schema_ready = False


def _ensure_schema(ws, config: AppConfig):
    """Create conversation/message tables on first call (idempotent)."""
    global _schema_ready
    if _schema_ready:
        return
    try:
        db.init_schema(ws, config)
        _schema_ready = True
        logger.info("DB schema ready.")
    except Exception as e:
        logger.warning(f"DB schema bootstrap failed (non-fatal): {e}")


# --- Routes ---


@router.get("/version", response_model=VersionOut, operation_id="version")
async def version():
    return VersionOut.from_metadata()


@router.get("/current-user", response_model=UserOut, operation_id="currentUser")
def me(user_ws: Dependencies.UserClient):
    return user_ws.current_user.me()


@router.post("/chat", response_model=ChatOut, operation_id="chat")
def chat(body: ChatIn, ws: Dependencies.Client, config: Dependencies.Config, headers: HeadersDependency):
    _ensure_schema(ws, config)
    conversation_id = body.conversation_id

    # Create conversation if needed
    if not conversation_id:
        try:
            conversation_id = db.create_conversation(ws, config, body.message[:80])
        except Exception:
            import uuid
            conversation_id = str(uuid.uuid4())

    # Save user message
    try:
        db.save_message(ws, config, conversation_id, "user", body.message)
    except Exception as e:
        logger.warning(f"Could not save user message: {e}")

    # Build message history from DB
    try:
        memory = db.get_messages(ws, config, conversation_id, limit=config.memory_window)
        messages = [{"role": m["role"], "content": m["content"]} for m in memory]
    except Exception:
        messages = [{"role": "user", "content": body.message}]

    # Query agent
    assistant_response, trace_id, citations = _query_agent_traced(
        ws, config, body.message, messages, user_email=headers.user_email
    )

    # Save assistant response with citation metadata
    try:
        citations_dicts = [c.model_dump() for c in citations] if citations else None
        db.save_message(ws, config, conversation_id, "assistant", assistant_response, citations=citations_dicts)
    except Exception as e:
        logger.warning(f"Could not save assistant message: {e}")

    return ChatOut(
        conversation_id=conversation_id,
        response=assistant_response,
        trace_id=trace_id,
        citations=citations,
    )


@router.get("/conversations", response_model=ConversationListOut, operation_id="listConversations")
def list_conversations(ws: Dependencies.Client, config: Dependencies.Config, limit: int = 15):
    _ensure_schema(ws, config)
    try:
        convos = db.list_conversations(ws, config, limit=limit)
        return ConversationListOut(
            conversations=[
                ConversationOut(id=c["id"], title=c.get("title"), updated_at=c.get("updated_at"))
                for c in convos
            ]
        )
    except Exception as e:
        logger.warning(f"Could not list conversations: {e}")
        return ConversationListOut(conversations=[])


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageOut], operation_id="getMessages")
def get_messages(conversation_id: str, ws: Dependencies.Client, config: Dependencies.Config, limit: int = 50):
    _ensure_schema(ws, config)
    try:
        msgs = db.get_messages(ws, config, conversation_id, limit=limit)
        result = []
        for m in msgs:
            raw_citations = m.get("citations")
            parsed_citations = None
            if raw_citations:
                # psycopg2 auto-parses JSONB to list[dict]
                if isinstance(raw_citations, str):
                    parsed_citations = [Citation(**c) for c in json.loads(raw_citations)]
                else:
                    parsed_citations = [Citation(**c) for c in raw_citations]
            result.append(MessageOut(role=m["role"], content=m["content"], citations=parsed_citations))
        return result
    except Exception as e:
        logger.warning(f"Could not get messages: {e}")
        return []


@router.delete("/conversations/{conversation_id}", operation_id="deleteConversation")
def delete_conversation(conversation_id: str, ws: Dependencies.Client, config: Dependencies.Config):
    try:
        db.delete_conversation(ws, config, conversation_id)
    except Exception as e:
        logger.warning(f"Could not delete conversation: {e}")
    return {"ok": True}


@router.post("/feedback", response_model=FeedbackOut, operation_id="submitFeedback")
def submit_feedback(body: FeedbackIn, config: Dependencies.Config, headers: HeadersDependency):
    _init_mlflow(config)
    success = _submit_feedback(body.trace_id, body.is_positive, body.comment, user_email=headers.user_email)
    return FeedbackOut(success=success)


# --- Document proxy ---


def _parse_citation_url(url: str) -> tuple[str, str, str | None, int | None]:
    """Parse a citation URL into (title, volume_path, highlight_text, page)."""
    import re
    parsed = urlparse(url)

    # Path: /ajax-api/2.0/fs/files/Volumes/catalog/schema/volume/file.txt
    path = parsed.path
    prefix = "/ajax-api/2.0/fs/files"
    if path.startswith(prefix):
        volume_path = path[len(prefix):]
    else:
        volume_path = path

    # Title from last path segment
    title = volume_path.rsplit("/", 1)[-1] if "/" in volume_path else volume_path

    # Parse fragment — may contain page=N and/or :~:text=...
    # Example: #page=38:~:text=L%27obertura...
    highlight = None
    page = None
    fragment = parsed.fragment
    if fragment:
        # Extract page number: page=38
        page_match = re.search(r"page=(\d+)", fragment)
        if page_match:
            page = int(page_match.group(1))
        # Extract text fragment
        if ":~:text=" in fragment:
            text_part = fragment.split(":~:text=", 1)[1]
            highlight = unquote(text_part).replace("\n", " ").strip()

    return title, volume_path, highlight, page


MAX_DOCUMENT_SIZE = 20 * 1024 * 1024  # 20 MB


@router.get("/document", response_model=DocumentOut, operation_id="getDocument")
def get_document(url: str, ws: Dependencies.Client):
    """Fetch a citation document from a UC Volume and return its content."""
    title, volume_path, highlight_text, page = _parse_citation_url(url)

    if not volume_path.startswith("/Volumes/"):
        return DocumentOut(title=title, content="Error: invalid document path.", highlight_text=None)

    try:
        import requests as http_requests
        headers = ws.config.authenticate()
        file_url = f"{ws.config.host}/api/2.0/fs/files{volume_path}"
        resp = http_requests.get(file_url, headers=headers, timeout=60, stream=True)
        resp.raise_for_status()

        # Check size via Content-Length or read with limit
        content_length = resp.headers.get("Content-Length")
        if content_length and int(content_length) > MAX_DOCUMENT_SIZE:
            return DocumentOut(
                title=title,
                content="Error: document is too large to display inline.",
                highlight_text=None,
            )

        # Detect content type from response header or file extension
        ct = resp.headers.get("Content-Type", "").split(";")[0].strip()
        if not ct or ct == "application/octet-stream":
            ct = mimetypes.guess_type(volume_path)[0] or "text/plain"

        if ct == "application/pdf":
            raw_bytes = resp.content[:MAX_DOCUMENT_SIZE]
            b64 = base64.b64encode(raw_bytes).decode("ascii")
            return DocumentOut(
                title=title,
                content=b64,
                content_type="application/pdf",
                highlight_text=highlight_text,
                page=page,
            )

        content = resp.text[:MAX_DOCUMENT_SIZE]
        return DocumentOut(title=title, content=content, content_type="text/plain", highlight_text=highlight_text, page=page)

    except Exception as e:
        logger.warning(f"Could not fetch document {volume_path}: {e}")
        return DocumentOut(
            title=title,
            content=f"Error: could not load document ({e})",
            highlight_text=None,
        )
