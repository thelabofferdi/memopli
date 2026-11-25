"""Espace compte : profil de l'entreprise modifiable, liste des dossiers, isolation."""
from __future__ import annotations

import uuid

from tests.conftest import add_requirement, db_rows, make_tender

MOT_DE_PASSE = "motdepasse123"


def _compte(client, org_name="Gamma BTP"):
    email = f"user-{uuid.uuid4().hex[:8]}@example.com"
    body = client.post("/api/auth/signup", json={"email": email, "password": MOT_DE_PASSE, "org_name": org_name}).json()
    return body, {"Authorization": f"Bearer {body['token']}"}


def test_completer_le_profil(client):
    body, h = _compte(client)
    oid = body["org"]["id"]
    res = client.patch(f"/api/orgs/{oid}", json={"ifu": " 3202400001234 ", "headcount": 24}, headers=h)
    assert res.status_code == 200, res.text
    assert res.json()["ifu"] == "3202400001234"
    assert res.json()["headcount"] == 24
    assert res.json()["name"] == "Gamma BTP"  # champ non envoyé : inchangé


def test_profil_rien_a_modifier_et_nom_vide(client):
    body, h = _compte(client)
    oid = body["org"]["id"]
    assert client.patch(f"/api/orgs/{oid}", json={}, headers=h).json()["error"]["code"] == "rien_a_modifier"
    assert client.patch(f"/api/orgs/{oid}", json={"name": None}, headers=h).status_code == 400
    assert client.patch(f"/api/orgs/{oid}", json={"name": "x"}, headers=h).status_code == 422


def test_effacer_un_champ_facultatif(client):
    body, h = _compte(client)
    oid = body["org"]["id"]
    client.patch(f"/api/orgs/{oid}", json={"sector": "BTP"}, headers=h)
    assert client.patch(f"/api/orgs/{oid}", json={"sector": None}, headers=h).json()["sector"] is None


def test_lister_les_dossiers(client):
    body, h = _compte(client)
    oid = body["org"]["id"]
    assert client.get(f"/api/orgs/{oid}/tenders", headers=h).json() == []
    tid = make_tender(oid)
    add_requirement(tid)
    listed = client.get(f"/api/orgs/{oid}/tenders", headers=h).json()
    assert [t["id"] for t in listed] == [tid]
    assert listed[0]["requirements"] == 1
    assert listed[0]["drafts"] == 0
    assert "text_path" not in listed[0] and "file_path" not in listed[0]


def test_isolation_entre_comptes(client):
    a, ha = _compte(client)
    _, hb = _compte(client)
    oid = a["org"]["id"]
    make_tender(oid)
    assert client.get(f"/api/orgs/{oid}/tenders", headers=hb).status_code == 404
    assert client.patch(f"/api/orgs/{oid}", json={"sector": "pirate"}, headers=hb).status_code == 404
    assert client.get(f"/api/orgs/{oid}", headers=ha).json()["sector"] is None


def test_organisation_inconnue(client):
    assert client.get("/api/orgs/org_000000000000/tenders").status_code == 404


def test_nom_en_espaces_refuse(client):
    body, h = _compte(client)
    oid = body["org"]["id"]
    res = client.patch(f"/api/orgs/{oid}", json={"name": "   "}, headers=h)
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "requete_invalide"
    assert client.get(f"/api/orgs/{oid}", headers=h).json()["name"] == "Gamma BTP"


def test_champ_facultatif_vide_est_efface(client):
    body, h = _compte(client)
    oid = body["org"]["id"]
    client.patch(f"/api/orgs/{oid}", json={"ifu": "3202400001234"}, headers=h)
    assert client.patch(f"/api/orgs/{oid}", json={"ifu": "   "}, headers=h).json()["ifu"] is None


def test_patch_ne_change_pas_le_proprietaire(client):
    body, h = _compte(client)
    oid = body["org"]["id"]
    res = client.patch(f"/api/orgs/{oid}", json={"user_id": "usr_pirate"}, headers=h)
    assert res.status_code == 400
    assert db_rows("SELECT user_id FROM organizations WHERE id=?", (oid,))[0]["user_id"] == body["user"]["id"]
