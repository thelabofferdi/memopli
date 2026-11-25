"""Harnais de test : base temporaire, client TestClient, garde-fous remis à zéro."""
from __future__ import annotations

import os
import sys
import tempfile
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

TMP = Path(tempfile.mkdtemp(prefix="memopli-tests-"))
# les tests ne lisent jamais le .env du poste : configuration explicite seulement
os.environ["ENV_FILE"] = str(TMP / "absent.env")
os.environ["DATABASE_PATH"] = str(TMP / "test.db")
os.environ["UPLOAD_DIR"] = str(TMP / "uploads")
os.environ["AUTH_REQUIRED"] = "false"
os.environ["RATE_LIMIT"] = "false"
os.environ["RODIUM_API_KEY"] = ""
os.environ["APP_ENV"] = "dev"
os.environ["DOCS_ENABLED"] = "true"  # test_errors vérifie /openapi.json
os.environ["ALLOWED_HOSTS"] = "127.0.0.1,localhost,testserver"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import ratelimit  # noqa: E402
from app.config import settings  # noqa: E402
from app.db import UPLOAD_DIR, connect, init_db, rows  # noqa: E402
from app.ids import nid  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _schema():
    init_db()
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@pytest.fixture
def client():
    ratelimit.reset()
    settings.auth_required = False
    settings.rate_limit = False
    settings.max_upload_mb = 20
    with TestClient(app) as test_client:
        yield test_client
    ratelimit.reset()


@pytest.fixture
def org(client) -> str:
    res = client.post("/api/orgs", json={"name": "Entreprise " + uuid.uuid4().hex[:6]})
    assert res.status_code == 200, res.text
    return res.json()["id"]


@pytest.fixture
def tender(org) -> str:
    return make_tender(org)


def make_tender(org_id: str, chars: int = 1200) -> str:
    """Insère un DAO directement en base : l'extraction du texte est déjà couverte ailleurs."""
    tid = nid("td")
    text_path = UPLOAD_DIR / f"{tid}.txt"
    text_path.write_text("--- PAGE 1 ---\n" + ("bordereau administratif " * (chars // 20)), encoding="utf-8")
    with connect() as conn:
        conn.execute(
            "INSERT INTO tenders(id,org_id,title,buyer,deadline,file_path,text_path,page_count,created_at)"
            " VALUES (?,?,?,?,?,?,?,?,?)",
            (tid, org_id, None, None, None, None, str(text_path), 1, "2026-11-25"),
        )
    return tid


def add_requirement(tender_id: str, label: str = "Attestation fiscale") -> str:
    rid = nid("rq")
    with connect() as conn:
        conn.execute(
            "INSERT INTO requirements(id,tender_id,label,kind,mandatory,created_at) VALUES (?,?,?,?,?,?)",
            (rid, tender_id, label, "piece", 1, "2026-11-25"),
        )
    return rid


def db_rows(sql: str, args: tuple = ()) -> list[dict]:
    with connect() as conn:
        return rows(conn.execute(sql, args))
