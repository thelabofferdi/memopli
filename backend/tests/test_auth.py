"""Comptes et isolation : mot de passe haché, jeton haché, cloisonnement par organisation."""
from __future__ import annotations

import uuid

from app.config import settings
from tests.conftest import db_rows

MOT_DE_PASSE = "motdepasse123"


def _inscription(client, email=None, org_name="Alpha BTP"):
    email = email or f"user-{uuid.uuid4().hex[:8]}@example.com"
    res = client.post("/api/auth/signup", json={"email": email, "password": MOT_DE_PASSE, "org_name": org_name})
    assert res.status_code == 200, res.text
    return res.json()


def test_inscription_cree_compte_org_et_jeton(client):
    body = _inscription(client)
    assert body["token"].startswith("mpl_")
    assert body["user"]["id"].startswith("usr_")
    assert body["org"]["id"].startswith("org_")
    assert body["org"]["name"] == "Alpha BTP"


def test_email_normalise_et_mot_de_passe_hache(client):
    body = _inscription(client, email="  MAJUSCULE@Example.COM ")
    assert body["user"]["email"] == "majuscule@example.com"
    stored = db_rows("SELECT password_hash FROM users WHERE id=?", (body["user"]["id"],))[0]
    assert stored["password_hash"].startswith("pbkdf2_sha256$")
    assert MOT_DE_PASSE not in stored["password_hash"]


def test_jeton_jamais_stocke_en_clair(client):
    body = _inscription(client)
    session = db_rows("SELECT token_hash FROM sessions WHERE user_id=?", (body["user"]["id"],))[0]
    assert session["token_hash"] != body["token"]
    assert len(session["token_hash"]) == 64


def test_email_deja_pris(client):
    body = _inscription(client)
    res = client.post("/api/auth/signup", json={"email": body["user"]["email"], "password": MOT_DE_PASSE})
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "compte_existant"


def test_email_invalide_refuse(client):
    res = client.post("/api/auth/signup", json={"email": "pas-un-email", "password": MOT_DE_PASSE})
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "identifiants_invalides"


def test_connexion_et_mauvais_mot_de_passe(client):
    body = _inscription(client)
    ok = client.post("/api/auth/login", json={"email": body["user"]["email"], "password": MOT_DE_PASSE})
    assert ok.status_code == 200
    assert ok.json()["token"].startswith("mpl_")
    ko = client.post("/api/auth/login", json={"email": body["user"]["email"], "password": "faux"})
    assert ko.status_code == 401
    assert ko.json()["error"]["code"] == "identifiants_invalides"


def test_me_exige_un_jeton(client):
    assert client.get("/api/auth/me").status_code == 401
    body = _inscription(client)
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {body['token']}"})
    assert me.status_code == 200
    assert me.json()["user"]["email"] == body["user"]["email"]
    assert [o["id"] for o in me.json()["orgs"]] == [body["org"]["id"]]


def test_deconnexion_revoque_le_jeton(client):
    body = _inscription(client)
    entetes = {"Authorization": f"Bearer {body['token']}"}
    assert client.post("/api/auth/logout", headers=entetes).status_code == 200
    assert client.get("/api/auth/me", headers=entetes).status_code == 401


def test_org_rattachee_a_son_createur(client):
    body = _inscription(client)
    entetes = {"Authorization": f"Bearer {body['token']}"}
    creee = client.post("/api/orgs", json={"name": "Deuxieme SARL"}, headers=entetes)
    assert creee.status_code == 200
    ligne = db_rows("SELECT user_id FROM organizations WHERE id=?", (creee.json()["id"],))[0]
    assert ligne["user_id"] == body["user"]["id"]


def test_drapeau_auth_requise_ferme_l_api(client):
    body = _inscription(client)
    settings.auth_required = True
    try:
        assert client.get("/health").status_code == 200  # la santé reste ouverte
        res = client.get(f"/api/pieces?org_id={body['org']['id']}")
        assert res.status_code == 401
        assert res.json()["error"]["code"] == "non_authentifie"
        ok = client.get(
            f"/api/pieces?org_id={body['org']['id']}",
            headers={"Authorization": f"Bearer {body['token']}"},
        )
        assert ok.status_code == 200
    finally:
        settings.auth_required = False


def test_jeton_invalide_refuse_meme_drapeau_eteint(client):
    settings.auth_required = True
    try:
        res = client.get("/api/pieces?org_id=org_x", headers={"Authorization": "Bearer mpl_faux"})
        assert res.status_code == 401
    finally:
        settings.auth_required = False


def test_cloisonnement_entre_organisations(client):
    a = _inscription(client, org_name="Alpha")
    b = _inscription(client, org_name="Beta")
    entetes_a = {"Authorization": f"Bearer {a['token']}"}
    entetes_b = {"Authorization": f"Bearer {b['token']}"}

    piece = client.post(
        "/api/pieces",
        data={"org_id": a["org"]["id"], "kind": "cnss", "label": "CNSS Alpha", "expires_on": "2027-01-01"},
        headers=entetes_a,
    )
    assert piece.status_code == 200, piece.text

    # même drapeau éteint : un jeton présent borne l'accès à ses propres organisations
    assert client.get(f"/api/pieces?org_id={a['org']['id']}", headers=entetes_b).status_code == 404
    assert client.get(f"/api/orgs/{a['org']['id']}", headers=entetes_b).status_code == 404
    assert client.get(f"/api/pieces?org_id={a['org']['id']}", headers=entetes_a).status_code == 200

    # et l'écriture est fermée aussi
    refus = client.post(
        "/api/pieces",
        data={"org_id": a["org"]["id"], "kind": "cnss", "label": "intrusion"},
        headers=entetes_b,
    )
    assert refus.status_code == 404


def test_cloisonnement_sur_un_dao(client):
    a = _inscription(client, org_name="Alpha")
    b = _inscription(client, org_name="Beta")
    from tests.conftest import make_tender

    tid = make_tender(a["org"]["id"])
    res = client.get(f"/api/tenders/{tid}", headers={"Authorization": f"Bearer {b['token']}"})
    assert res.status_code == 404
    res = client.get(f"/api/tenders/{tid}/readiness", headers={"Authorization": f"Bearer {b['token']}"})
    assert res.status_code == 404
    res = client.get(f"/api/tenders/{tid}", headers={"Authorization": f"Bearer {a['token']}"})
    assert res.status_code == 200


def test_session_expiree_refusee_et_purgee(client):
    from app.db import connect

    body = _inscription(client)
    with connect() as conn:
        conn.execute("UPDATE sessions SET expires_at=1 WHERE user_id=?", (body["user"]["id"],))
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {body['token']}"})
    assert res.status_code == 401
    assert db_rows("SELECT token_hash FROM sessions WHERE user_id=?", (body["user"]["id"],)) == []


def test_jeton_malforme_refuse(client):
    for entete in ("Bearer", "Basic abc", "Bearer  ", "mpl_sans_schema"):
        res = client.get("/api/auth/me", headers={"Authorization": entete})
        assert res.status_code == 401, entete
