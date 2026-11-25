"""Tests de fumée : la base se crée, une organisation s'insère.

Les règles de statut sont dans `test_statuts.py` : une seule maison par règle.
"""
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("DATABASE_PATH", str(Path(tempfile.mkdtemp()) / "test.db"))

from app.db import connect, init_db, rows  # noqa: E402


def test_db_roundtrip():
    init_db()
    with connect() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO organizations(id,name,created_at) VALUES ('org_x','Test','2026-11-25')"
        )
        assert rows(conn.execute("SELECT name FROM organizations WHERE id='org_x'"))[0]["name"] == "Test"
