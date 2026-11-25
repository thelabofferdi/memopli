"""Migration : une base créée avant l'authentification doit s'ouvrir sans intervention."""
from __future__ import annotations

import sqlite3

from app import db


def test_base_ancienne_migree(tmp_path, monkeypatch):
    ancienne = tmp_path / "vieux.db"
    with sqlite3.connect(ancienne) as raw:
        raw.execute(
            "CREATE TABLE organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL, ifu TEXT,"
            " rccm TEXT, sector TEXT, headcount INTEGER, created_at TEXT NOT NULL)"
        )
        raw.execute("INSERT INTO organizations(id,name,created_at) VALUES ('org_old','Ancienne','2026-01-01')")

    monkeypatch.setattr(db, "DB_PATH", ancienne)
    db.init_db()
    db.init_db()  # idempotent : deux démarrages de suite ne cassent rien

    with db.connect() as conn:
        colonnes = {ligne["name"] for ligne in conn.execute("PRAGMA table_info(organizations)")}
        assert "user_id" in colonnes
        assert db.rows(conn.execute("SELECT name FROM organizations"))[0]["name"] == "Ancienne"
        tables = {ligne["name"] for ligne in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        assert {"users", "sessions", "ai_calls"} <= tables
        index = {ligne["name"] for ligne in conn.execute("SELECT name FROM sqlite_master WHERE type='index'")}
        assert "idx_orgs_user" in index
