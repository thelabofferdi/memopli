"""Contrat d'erreur et en-têtes HTTP : le frontend doit toujours pouvoir expliquer l'échec."""
from __future__ import annotations


def test_404_respecte_le_contrat(client):
    res = client.get("/api/organisations/org_inexistant")
    assert res.status_code == 404
    body = res.json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == "introuvable"
    assert body["error"]["message"]
    assert body["error"]["request_id"]


def test_route_inconnue_respecte_le_contrat(client):
    res = client.get("/api/nexiste-pas")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "introuvable"


def test_validation_respecte_le_contrat(client):
    res = client.post("/api/orgs", json={"name": "x"})
    assert res.status_code == 422
    error = res.json()["error"]
    assert error["code"] == "requete_invalide"
    assert "name" in error["message"]


def test_en_tetes_de_securite(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.headers["X-Content-Type-Options"] == "nosniff"
    assert res.headers["X-Frame-Options"] == "DENY"
    assert res.headers["Referrer-Policy"] == "no-referrer"
    assert "default-src 'self'" in res.headers["Content-Security-Policy"]
    assert len(res.headers["X-Request-ID"]) >= 8


def test_request_id_propage(client):
    res = client.get("/health", headers={"x-request-id": "abc123def456"})
    assert res.headers["X-Request-ID"] == "abc123def456"


def test_request_id_invalide_remplace(client):
    res = client.get("/health", headers={"x-request-id": "court"})
    assert res.headers["X-Request-ID"] != "court"
    assert len(res.headers["X-Request-ID"]) == 32


def test_hote_inconnu_refuse(client):
    res = client.get("/health", headers={"host": "attaquant.example"})
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "hote_non_autorise"


def test_pas_de_cache_sur_api(client):
    assert client.get("/health").headers["Cache-Control"] == "no-store"


def test_openapi_se_construit(client):
    res = client.get("/openapi.json")
    assert res.status_code == 200
    paths = res.json()["paths"]
    assert "/api/tenders/{tender_id}/readiness" in paths
    assert "/api/auth/login" in paths
