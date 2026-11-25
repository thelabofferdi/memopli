"""Journal des appels IA : trace persistée, coût recalculé, échec au message court."""
from __future__ import annotations

from app import main
from tests.conftest import db_rows


def _fake(meta_cost=3.84):
    def fake(system, prompt, model):
        return (
            {"title": "T", "buyer": "B", "deadline": None,
             "requirements": [{"label": "Attestation fiscale", "kind": "piece", "page": 3}], "grid": []},
            {"model": model, "seconds": 1.25, "tokens_in": 1200, "tokens_out": 400, "cost_fcfa": meta_cost},
        )
    return fake


def test_appel_journalise_et_cout_recalcule(client, tender, monkeypatch):
    monkeypatch.setattr(main.ai, "chat_json", _fake())
    assert client.post(f"/api/tenders/{tender}/requirements").status_code == 200

    cout = client.get(f"/api/tenders/{tender}/cost").json()
    assert cout["totals"]["appels"] == 1
    assert cout["totals"]["tokens_in"] == 1200
    assert cout["totals"]["tokens_out"] == 400
    assert cout["totals"]["cost_fcfa"] == 3.84
    assert cout["totals"]["seconds"] == 1.25
    assert cout["calls"][0]["task"] == "extraction"
    assert cout["calls"][0]["ok"] == 1

    client.post(f"/api/tenders/{tender}/requirements")
    assert client.get(f"/api/tenders/{tender}/cost").json()["totals"]["appels"] == 2


def test_appel_journalise_porte_le_request_id(client, tender, monkeypatch):
    monkeypatch.setattr(main.ai, "chat_json", _fake())
    client.post(f"/api/tenders/{tender}/requirements", headers={"x-request-id": "trace0123456789"})
    ligne = db_rows("SELECT request_id FROM ai_calls WHERE tender_id=?", (tender,))[0]
    assert ligne["request_id"] == "trace0123456789"


def test_echec_ia_message_court_et_journalise(client, tender, monkeypatch):
    def boom(system, prompt, model):
        raise main.ai.AIError("401 fournisseur : clé sk-secret-refusee")

    monkeypatch.setattr(main.ai, "chat_json", boom)
    res = client.post(f"/api/tenders/{tender}/requirements")
    assert res.status_code == 502
    assert res.json()["error"]["code"] == "ia_indisponible"
    assert "sk-secret" not in res.text
    assert "reessayez" in res.text or "réessayez" in res.text

    trace = db_rows("SELECT ok, cost_fcfa, task FROM ai_calls WHERE tender_id=?", (tender,))
    assert trace == [{"ok": 0, "cost_fcfa": 0.0, "task": "extraction"}]


def test_cout_par_dossier_isole(client, tender):
    from tests.conftest import make_tender

    autre = make_tender(client.get(f"/api/tenders/{tender}").json()["org_id"])
    assert client.get(f"/api/tenders/{autre}/cost").json()["totals"]["appels"] == 0
