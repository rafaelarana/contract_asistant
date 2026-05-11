from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from .. import __version__


class VersionOut(BaseModel):
    version: str

    @classmethod
    def from_metadata(cls):
        return cls(version=__version__)


# --- Chat ---


class ChatIn(BaseModel):
    message: str
    conversation_id: str | None = None
    lang: str = "ca"


class Citation(BaseModel):
    title: str
    url: str
    page: int | None = None


class ChatOut(BaseModel):
    conversation_id: str
    response: str
    trace_id: str | None = None
    citations: list[Citation] = []


class DocumentOut(BaseModel):
    title: str
    content: str
    content_type: str = "text/plain"
    highlight_text: str | None = None
    page: int | None = None


# --- Conversations ---


class ConversationOut(BaseModel):
    id: str
    title: str | None = None
    updated_at: datetime | None = None


class ConversationListOut(BaseModel):
    conversations: list[ConversationOut]


# --- Feedback ---


class FeedbackIn(BaseModel):
    trace_id: str
    is_positive: bool
    comment: str = ""


class FeedbackOut(BaseModel):
    success: bool


# --- Messages ---


class MessageOut(BaseModel):
    role: str
    content: str
    citations: list[Citation] | None = None
