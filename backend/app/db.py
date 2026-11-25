"""Accès SQLite : schéma, migration et petits utilitaires.

Une connexion par opération, refermée à la sortie du bloc `with` ; les écritures
sont sérialisées par SQLite (timeout court pour éviter l'attente infinie).
"""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from typing import Iterator

from .config import settings

DB_PATH = settings.db_path
UPLOAD_DIR = settings.upload_dir

SCHEMA = """
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY, user_id TEXT, name TEXT NOT NULL, ifu TEXT, rccm TEXT,
  sector TEXT, headcount INTEGER, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, last_seen INTEGER
);
CREATE TABLE IF NOT EXISTS pieces (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, kind TEXT NOT NULL, label TEXT NOT NULL,
  file_path TEXT, expires_on TEXT, verified INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tenders (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, title TEXT, buyer TEXT, deadline TEXT,
  file_path TEXT, text_path TEXT, page_count INTEGER, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS requirements (
  id TEXT PRIMARY KEY, tender_id TEXT NOT NULL, label TEXT NOT NULL, kind TEXT NOT NULL,
  mandatory INTEGER NOT NULL DEFAULT 1, weight REAL, page INTEGER, excerpt TEXT,
  confidence REAL, corrected INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY, requirement_id TEXT NOT NULL, piece_id TEXT,
  status TEXT NOT NULL, reason TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY, tender_id TEXT NOT NULL, section TEXT NOT NULL, content TEXT NOT NULL,
  model TEXT, tokens_in INTEGER, tokens_out INTEGER, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, tender_id TEXT, piece_id TEXT,
  kind TEXT NOT NULL, filename TEXT, mime TEXT, bytes INTEGER, pages INTEGER, chars INTEGER,
  status TEXT NOT NULL, text_path TEXT, ocr_lang TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY, document_id TEXT NOT NULL, page INTEGER, ordre INTEGER NOT NULL,
  text TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS agent_messages (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, tender_id TEXT, role TEXT NOT NULL,
  content TEXT NOT NULL, citations TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_calls (
  id TEXT PRIMARY KEY, request_id TEXT, task TEXT NOT NULL, model TEXT,
  tokens_in INTEGER NOT NULL DEFAULT 0, tokens_out INTEGER NOT NULL DEFAULT 0,
  seconds REAL NOT NULL DEFAULT 0, cost_fcfa REAL NOT NULL DEFAULT 0,
  tender_id TEXT, ok INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
);
"""

# les index sont créés après la migration : ils peuvent porter sur une colonne ajoutée
INDEXES = """
CREATE INDEX IF NOT EXISTS idx_pieces_org ON pieces(org_id);
CREATE INDEX IF NOT EXISTS idx_tenders_org ON tenders(org_id);
CREATE INDEX IF NOT EXISTS idx_requirements_tender ON requirements(tender_id);
CREATE INDEX IF NOT EXISTS idx_matches_requirement ON matches(requirement_id);
CREATE INDEX IF NOT EXISTS idx_drafts_tender ON drafts(tender_id);
CREATE INDEX IF NOT EXISTS idx_ai_calls_tender ON ai_calls(tender_id);
CREATE INDEX IF NOT EXISTS idx_orgs_user ON organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_org ON documents(org_id, tender_id);
CREATE INDEX IF NOT EXISTS idx_documents_piece ON documents(piece_id);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id, ordre);
CREATE INDEX IF NOT EXISTS idx_agent_org ON agent_messages(org_id, created_at);
"""


def _ensure_column(conn: sqlite3.Connection, table: str, column: str, ddl: str) -> None:
    """Ajoute une colonne manquante aux bases créées avant la migration."""
    existing = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})")}
    if column not in existing:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")


def _migrate(conn: sqlite3.Connection) -> None:
    _ensure_column(conn, "organizations", "user_id", "TEXT")


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=5)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except BaseException:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        conn.executescript(SCHEMA)
        _migrate(conn)
        conn.executescript(INDEXES)


def rows(cur) -> list[dict]:
    return [dict(r) for r in cur.fetchall()]
