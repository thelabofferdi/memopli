"""Intégrité : entrées validées, extraction idempotente, verdict jamais faux."""
from __future__ import annotations

from app import main
from tests.conftest import add_requirement, db_rows, make_tender


def test_patch_refuse_un_type_invalide(client, tender):
    rid = add_requirement(tender)
    res = client.patch(f"/api/requirements/{rid}", json={"page": "huit"})
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "requete_invalide"


def test_patch_refuse_un_champ_inconnu(client, tender):
    rid = add_requirement(tender)
    res = client.patch(f"/api/requirements/{rid}", json={"couleur": "rouge"})
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "rien_a_modifier"


def test_patch_refuse_un_kind_inconnu(client, tender):
    rid = add_requirement(tender)
    assert client.patch(f"/api/requirements/{rid}", json={"kind": "autre"}).status_code == 422


def test_patch_enregistre_une_correction(client, tender):
    rid = add_requirement(tender)
    res = client.patch(f"/api/requirements/{rid}", json={"label": "Attestation fiscale 2026", "mandatory": False})
    assert res.status_code == 200
    ligne = db_rows("SELECT label, mandatory, corrected FROM requirements WHERE id=?", (rid,))[0]
    assert ligne == {"label": "Attestation fiscale 2026", "mandatory": 0, "corrected": 1}


def test_patch_sur_exigence_inconnue(client):
    assert client.patch("/api/requirements/rq_inexistant", json={"label": "x"}).status_code == 404


def test_piece_type_inconnu_refuse(client, org):
    res = client.post("/api/pieces", data={"org_id": org, "kind": "diplome", "label": "Licence"})
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "type_inconnu"


def test_piece_date_invalide_refusee(client, org):
    res = client.post(
        "/api/pieces",
        data={"org_id": org, "kind": "cnss", "label": "CNSS", "expires_on": "31/12/2026"},
    )
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "date_invalide"


def test_piece_org_inconnue_refusee(client):
    res = client.post("/api/pieces", data={"org_id": "org_inexistante", "kind": "cnss", "label": "CNSS"})
    assert res.status_code == 404


def _fake_extraction():
    def fake(system, prompt, model):
        return {
            "title": "Fourniture de matériel",
            "buyer": "Ministère",
            "deadline": "2026-12-15",
            "requirements": [
                {"label": "Attestation fiscale", "kind": "piece", "page": 3},
                {"label": "Attestation CNSS", "kind": "piece", "page": 4},
            ],
            "grid": [{"label": "Prix", "kind": "critere", "weight": 40, "page": 9}],
        }, {"model": model, "seconds": 1.25, "tokens_in": 1200, "tokens_out": 400, "cost_fcfa": 3.84}

    return fake


def test_extraction_idempotente(client, tender, monkeypatch):
    monkeypatch.setattr(main.ai, "chat_json", _fake_extraction())
    premier = client.post(f"/api/tenders/{tender}/requirements")
    assert premier.status_code == 200, premier.text
    assert premier.json()["count"] == 3
    second = client.post(f"/api/tenders/{tender}/requirements")
    assert second.json()["count"] == 3
    assert second.json()["replaced"] is True
    lignes = db_rows("SELECT id FROM requirements WHERE tender_id=?", (tender,))
    assert len(lignes) == 3  # relancer remplace, n'empile pas


def test_rapprochement_ignore_une_exigence_etrangere(client, org, tender, monkeypatch):
    autre_tender = make_tender(org)
    rid_local = add_requirement(tender, "Attestation fiscale")
    rid_etranger = add_requirement(autre_tender, "Exigence d'un autre dossier")
    piece = client.post(
        "/api/pieces",
        data={"org_id": org, "kind": "attestation_fiscale", "label": "Attestation fiscale", "expires_on": "2099-01-01"},
    ).json()["id"]

    def fake(system, prompt, model):
        return {"matches": [
            {"requirement_id": rid_etranger, "piece_id": piece, "reason": "hors dossier"},
            {"requirement_id": rid_local, "piece_id": piece, "reason": "même intitulé"},
        ]}, {"model": model, "seconds": 0.5, "tokens_in": 100, "tokens_out": 50, "cost_fcfa": 0.42}

    monkeypatch.setattr(main.ai, "chat_json", fake)
    res = client.post(f"/api/tenders/{tender}/match")
    assert res.status_code == 200, res.text
    assert res.json()["matched"] == 1
    assert db_rows("SELECT requirement_id FROM matches") == [{"requirement_id": rid_local}]


def test_verdict_invalide_quand_la_piece_disparait(client, org, tender, monkeypatch):
    rid = add_requirement(tender)
    piece = client.post(
        "/api/pieces",
        data={"org_id": org, "kind": "attestation_fiscale", "label": "Attestation fiscale", "expires_on": "2099-01-01"},
    ).json()["id"]

    monkeypatch.setattr(main.ai, "chat_json", lambda s, p, m: (
        {"matches": [{"requirement_id": rid, "piece_id": piece, "reason": "ok"}]},
        {"model": m, "seconds": 0.1, "tokens_in": 10, "tokens_out": 5, "cost_fcfa": 0.01},
    ))
    client.post(f"/api/tenders/{tender}/match")
    verdict = client.get(f"/api/tenders/{tender}/readiness").json()
    assert verdict["ready"] is True and verdict["matched"] == 1

    client.delete(f"/api/pieces/{piece}")
    apres = client.get(f"/api/tenders/{tender}/readiness").json()
    assert apres["ready"] is False
    assert apres["matched"] == 0
    assert apres["blockers"][0]["status"] == "manquant"
