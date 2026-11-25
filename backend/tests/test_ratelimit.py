"""Limitation de débit : les routes payantes et l'authentification sont plafonnées."""
from __future__ import annotations

from app.config import settings
from tests.test_uploads import PDF


def test_connexions_plafonnees(client):
    settings.rate_limit = True
    settings.rate_auth_per_minute = 2
    try:
        codes = [
            client.post("/api/auth/login", json={"email": "a@b.co", "password": "x"}).status_code
            for _ in range(3)
        ]
        assert codes == [401, 401, 429]

        refus = client.post("/api/auth/login", json={"email": "a@b.co", "password": "x"})
        assert refus.status_code == 429
        assert refus.json()["error"]["code"] == "trop_de_requetes"
        assert int(refus.headers["Retry-After"]) >= 1
        assert refus.json()["error"]["request_id"]
    finally:
        settings.rate_limit = False
        settings.rate_auth_per_minute = 10


def test_uploads_plafonnes(client, org):
    settings.rate_limit = True
    settings.rate_upload_per_hour = 1
    try:
        premier = client.post(
            "/api/pieces",
            data={"org_id": org, "kind": "cnss", "label": "CNSS", "expires_on": "2027-01-01"},
            files={"file": ("cnss.pdf", PDF, "application/pdf")},
        )
        second = client.post(
            "/api/pieces",
            data={"org_id": org, "kind": "rccm", "label": "RCCM", "expires_on": "2027-01-01"},
            files={"file": ("rccm.pdf", PDF, "application/pdf")},
        )
    finally:
        settings.rate_limit = False
        settings.rate_upload_per_hour = 60
    assert premier.status_code == 200
    assert second.status_code == 429


def test_lecture_non_plafonnee(client, org):
    settings.rate_limit = True
    settings.rate_upload_per_hour = 1
    try:
        assert client.get(f"/api/pieces?org_id={org}").status_code == 200
        assert client.get(f"/api/pieces?org_id={org}").status_code == 200
        assert client.get("/health").status_code == 200
    finally:
        settings.rate_limit = False
        settings.rate_upload_per_hour = 60
