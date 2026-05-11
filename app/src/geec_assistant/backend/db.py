"""Lakebase chat memory: stores conversations and messages for short-term memory."""

import uuid
from datetime import datetime

import psycopg2
from psycopg2.extras import RealDictCursor
from databricks.sdk import WorkspaceClient

from .core._config import AppConfig


def _get_lakebase_token(w: WorkspaceClient, config: AppConfig) -> str:
    """Generate a Lakebase-specific OAuth credential via the postgres credentials API."""
    resp = w.api_client.do(
        "POST",
        "/api/2.0/postgres/credentials",
        body={"endpoint": config.lakebase_endpoint},
    )
    return resp["token"]


def _get_connection(w: WorkspaceClient, config: AppConfig):
    """Get a PostgreSQL connection to the Lakebase database using Lakebase OAuth."""
    token = _get_lakebase_token(w, config)
    me = w.current_user.me()
    username = getattr(me, "application_id", None) or me.user_name

    conn = psycopg2.connect(
        host=config.lakebase_host,
        port=config.lakebase_port,
        dbname=config.lakebase_database,
        user=username,
        password=token,
        sslmode="require",
    )
    conn.autocommit = True
    return conn


def init_schema(w: WorkspaceClient, config: AppConfig):
    """Create tables if they don't exist."""
    conn = _get_connection(w, config)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    title TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    citations JSONB DEFAULT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_messages_conversation
                ON messages(conversation_id, created_at)
            """)
    finally:
        conn.close()


def create_conversation(w: WorkspaceClient, config: AppConfig, title: str = "Nueva conversación") -> str:
    """Create a new conversation and return its ID."""
    conv_id = str(uuid.uuid4())
    conn = _get_connection(w, config)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO conversations (id, title) VALUES (%s, %s)",
                (conv_id, title),
            )
    finally:
        conn.close()
    return conv_id


def save_message(w: WorkspaceClient, config: AppConfig, conversation_id: str, role: str, content: str, citations: list[dict] | None = None):
    """Save a message to the conversation, optionally with citation metadata."""
    import json as _json
    msg_id = str(uuid.uuid4())
    conn = _get_connection(w, config)
    try:
        with conn.cursor() as cur:
            citations_json = _json.dumps(citations) if citations else None
            cur.execute(
                "INSERT INTO messages (id, conversation_id, role, content, citations) VALUES (%s, %s, %s, %s, %s)",
                (msg_id, conversation_id, role, content, citations_json),
            )
            cur.execute(
                "UPDATE conversations SET updated_at = NOW(), title = CASE WHEN title = 'Nueva conversación' THEN LEFT(%s, 80) ELSE title END WHERE id = %s",
                (content, conversation_id),
            )
    finally:
        conn.close()


def get_messages(w: WorkspaceClient, config: AppConfig, conversation_id: str, limit: int = 20) -> list[dict]:
    """Get recent messages for a conversation (short-term memory window)."""
    conn = _get_connection(w, config)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT role, content, citations FROM messages
                WHERE conversation_id = %s
                ORDER BY created_at ASC
                LIMIT %s
                """,
                (conversation_id, limit),
            )
            return [dict(row) for row in cur.fetchall()]
    finally:
        conn.close()


def list_conversations(w: WorkspaceClient, config: AppConfig, limit: int = 20) -> list[dict]:
    """List recent conversations."""
    conn = _get_connection(w, config)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, title, updated_at FROM conversations
                ORDER BY updated_at DESC
                LIMIT %s
                """,
                (limit,),
            )
            return [dict(row) for row in cur.fetchall()]
    finally:
        conn.close()


def delete_conversation(w: WorkspaceClient, config: AppConfig, conversation_id: str):
    """Delete a conversation and all its messages."""
    conn = _get_connection(w, config)
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM conversations WHERE id = %s", (conversation_id,))
    finally:
        conn.close()
