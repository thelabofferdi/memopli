"""Tests de fumée : la base se crée, une organisation s'insère, le statut se calcule."""
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("DATABASE_PATH", str(Path(tempfile.mkdtemp()) / "test.db"))

from app.db import connect, init_db, rows  # noqa: E402
from app.main import compute_status  # noqa: E402


def test_db_roundtrip():
    init_db()
    with connect() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO organizations(id,name,created_at) VALUES ('org_x','Test','2026-11-25')"
        )
        assert rows(conn.execute("SELECT name FROM organizations WHERE id='org_x'"))[0]["name"] == "Test"


def test_status_rules():
    assert compute_status(None)[0] == "manquant"
    assert compute_status({"expires_on": None})[0] == "a_verifier"
    assert compute_status({"expires_on": "2020-01-01"})[0] == "perime"
    assert compute_status({"expires_on": "2099-01-01"})[0] == "valide"
