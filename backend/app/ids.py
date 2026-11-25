"""Identifiants et horodatages : préfixes `org_ pc_ td_ rq_ dr_` + uuid tronqué."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone


def nid(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def today() -> str:
    return date.today().isoformat()


def stamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def epoch() -> int:
    return int(datetime.now(timezone.utc).timestamp())
