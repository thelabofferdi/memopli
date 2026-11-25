"""Statuts : calculés par le code, à la lecture, à la date où le bailleur jugera la pièce."""
from __future__ import annotations

from datetime import date

from app import main, state
from app.db import connect
from tests.conftest import add_requirement, db_rows

META = {"model": "test", "seconds": 0.1, "tokens_in": 10, "tokens_out": 5, "cost_fcfa": 0.01}


def _rapprocher(client, monkeypatch, tender, rid, piece):
    monkeypatch.setattr(main.ai, "chat_json", lambda s, p, m: (
        {"matches": [{"requirement_id": rid, "piece_id": piece, "reason": "ok"}]}, META))
    assert client.post(f"/api/tenders/{tender}/match").status_code == 200


def _piece(client, org, expires_on, kind="attestation_fiscale"):
    res = client.post("/api/pieces", data={
        "org_id": org, "kind": kind, "label": "Attestation", "expires_on": expires_on})
    assert res.status_code == 200, res.text
    return res.json()["id"]


def _date_limite(tender, deadline):
    with connect() as conn:
        conn.execute("UPDATE tenders SET deadline=? WHERE id=?", (deadline, tender))


def test_statut_sans_date_limite():
    assert state.compute_status(None)[0] == "manquant"
    assert state.compute_status({"expires_on": None})[0] == "a_verifier"
    assert state.compute_status({"expires_on": "2020-01-01"})[0] == "perime"
    assert state.compute_status({"expires_on": "2099-01-01"})[0] == "valide"


def test_piece_qui_expire_avant_la_date_limite_est_perimee():
    statut, raison = state.compute_status(
        {"expires_on": "2026-09-30"}, deadline="2026-12-18", today="2026-08-01")
    assert statut == "perime"
    assert raison == "expirera le 30/09/2026, avant la date limite du 18/12/2026"


def test_piece_valable_le_jour_de_la_date_limite():
    assert state.compute_status(
        {"expires_on": "2026-12-18"}, deadline="2026-12-18", today="2026-08-01")[0] == "valide"


def test_piece_deja_expiree_garde_son_message():
    statut, raison = state.compute_status(
        {"expires_on": "2026-09-30"}, deadline="2026-12-18", today="2026-11-25")
    assert (statut, raison) == ("perime", "expirée le 30/09/2026")


def test_date_limite_depassee_ne_rend_pas_une_piece_perimee():
    # le DAO est clos mais la pièce reste valable aujourd'hui : on ne compare pas à une date passée
    assert state.compute_status(
        {"expires_on": "2026-12-01"}, deadline="2026-10-01", today="2026-11-25")[0] == "valide"


def test_une_date_de_piece_illisible_donne_a_verifier():
    statut, raison = state.compute_status({"expires_on": "30/09/2026"}, deadline="2026-12-18")
    assert statut == "a_verifier" and "illisible" in raison


def test_une_date_limite_illisible_est_ignoree():
    # une date limite qu'on ne sait pas lire n'allonge ni ne raccourcit la validité
    assert state.compute_status({"expires_on": "2099-01-01"}, deadline="18/12/2026")[0] == "valide"
    assert state.compute_status(
        {"expires_on": "2026-12-01"}, deadline="18/12/2026", today="2026-11-25")[0] == "valide"


def test_les_faits_jugent_les_pieces_a_la_date_du_dossier(client, org, tender, monkeypatch):
    # pièce valable aujourd'hui, expirée avant la date limite : l'agent doit le dire aussi
    rid = add_requirement(tender, "Attestation fiscale")
    piece = _piece(client, org, "2026-12-01")
    _date_limite(tender, "2026-12-18")
    _rapprocher(client, monkeypatch, tender, rid, piece)

    verdict = client.get(f"/api/tenders/{tender}/readiness").json()
    faits = state.facts(org, tender)
    assert verdict["blockers"][0]["status"] == "perime"
    assert faits["date_reference"] == max(date.today().isoformat(), "2026-12-18")
    assert "Attestation" in faits["pieces"]["perimees"]


def test_le_verdict_compare_a_la_date_limite_du_dossier(client, org, tender, monkeypatch):
    rid = add_requirement(tender, "Attestation fiscale")
    piece = _piece(client, org, "2099-06-30")
    _rapprocher(client, monkeypatch, tender, rid, piece)
    assert client.get(f"/api/tenders/{tender}/readiness").json()["ready"] is True

    _date_limite(tender, "2099-12-18")
    verdict = client.get(f"/api/tenders/{tender}/readiness").json()
    assert verdict["ready"] is False
    assert verdict["blockers"][0]["status"] == "perime"
    assert "avant la date limite" in verdict["blockers"][0]["reason"]


def test_une_piece_qui_expire_apres_le_rapprochement_bloque(client, org, tender, monkeypatch):
    rid = add_requirement(tender, "Attestation fiscale")
    piece = _piece(client, org, "2099-01-01")
    _rapprocher(client, monkeypatch, tender, rid, piece)
    assert client.get(f"/api/tenders/{tender}/readiness").json()["ready"] is True

    # la date de la pièce passe : le verdict suit sans relancer le rapprochement
    with connect() as conn:
        conn.execute("UPDATE pieces SET expires_on='2020-01-01' WHERE id=?", (piece,))
    verdict = client.get(f"/api/tenders/{tender}/readiness").json()
    assert verdict["ready"] is False
    assert verdict["blockers"][0]["status"] == "perime"
    assert verdict["blockers"][0]["expires_on"] == "2020-01-01"


def test_le_statut_stocke_suit_la_date_limite(client, org, tender, monkeypatch):
    rid = add_requirement(tender, "Attestation fiscale")
    piece = _piece(client, org, "2099-06-30")
    _date_limite(tender, "2099-12-18")
    _rapprocher(client, monkeypatch, tender, rid, piece)
    assert db_rows("SELECT status FROM matches")[-1]["status"] == "perime"


# ------------------------------------------------ le code vérifie le type de la pièce

def test_types_attendus_depuis_l_intitule():
    assert state.types_attendus("Attestation de la CNSS à jour") == {"cnss"}
    assert state.types_attendus("Quitus fiscal / attestation d'IFU") == {"attestation_fiscale"}
    assert state.types_attendus("Extrait du Registre du Commerce (RCCM)") == {"rccm"}
    assert state.types_attendus("Garantie de soumission") == set()


def test_types_compatibles():
    assert state.types_compatibles("Attestation CNSS", "cnss")
    assert not state.types_compatibles("Attestation CNSS", "attestation_fiscale")
    assert state.types_compatibles("Attestation CNSS", "autre")        # type libre : on ne rejette pas
    assert state.types_compatibles("Garantie de soumission", "bilan")  # intitulé non reconnu : pas jugé


def test_une_piece_de_mauvais_type_est_refusee(client, org, tender, monkeypatch):
    rid = add_requirement(tender, "Attestation CNSS à jour")
    fiscale = _piece(client, org, "2099-01-01", kind="attestation_fiscale")
    _rapprocher(client, monkeypatch, tender, rid, fiscale)
    ligne = db_rows("SELECT piece_id, status FROM matches")[-1]
    assert ligne == {"piece_id": None, "status": "manquant"}
    verdict = client.get(f"/api/tenders/{tender}/readiness").json()
    assert verdict["ready"] is False and verdict["blockers"][0]["status"] == "manquant"
    # l'écran doit dire pourquoi, pas « aucune pièce » alors qu'une pièce existe
    assert "mauvais type" in verdict["blockers"][0]["reason"]


def test_une_piece_du_bon_type_est_acceptee(client, org, tender, monkeypatch):
    rid = add_requirement(tender, "Attestation CNSS à jour")
    cnss = _piece(client, org, "2099-01-01", kind="cnss")
    monkeypatch.setattr(main.ai, "chat_json", lambda s, p, m: (
        {"matches": [{"requirement_id": rid, "piece_id": cnss, "reason": "ok"}]}, META))
    res = client.post(f"/api/tenders/{tender}/match").json()
    assert res["refused"] == 0
    assert client.get(f"/api/tenders/{tender}/readiness").json()["ready"] is True


def test_le_refus_est_compte_dans_la_reponse(client, org, tender, monkeypatch):
    rid = add_requirement(tender, "Attestation CNSS à jour")
    fiscale = _piece(client, org, "2099-01-01", kind="attestation_fiscale")
    monkeypatch.setattr(main.ai, "chat_json", lambda s, p, m: (
        {"matches": [{"requirement_id": rid, "piece_id": fiscale, "reason": "ok"}]}, META))
    assert client.post(f"/api/tenders/{tender}/match").json()["refused"] == 1


def test_les_criteres_ne_partent_pas_au_rapprochement(client, org, tender, monkeypatch):
    from app.db import connect
    from app.ids import nid
    add_requirement(tender, "Attestation fiscale")
    with connect() as conn:
        conn.execute(
            "INSERT INTO requirements(id,tender_id,label,kind,mandatory,created_at) VALUES (?,?,?,?,?,?)",
            (nid("rq"), tender, "Prix", "critere", 1, "2026-11-25"))
    vu = {}

    def fake(system, prompt, model):
        vu["prompt"] = prompt
        return {"matches": []}, META

    monkeypatch.setattr(main.ai, "chat_json", fake)
    client.post(f"/api/tenders/{tender}/match")
    assert "Attestation fiscale" in vu["prompt"] and "Prix" not in vu["prompt"]
