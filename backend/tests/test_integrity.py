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
    assert db_rows("SELECT requirement_id FROM matches WHERE requirement_id IN (?,?)",
                   (rid_local, rid_etranger)) == [{"requirement_id": rid_local}]


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


def test_extraction_marque_les_exigences_a_verifier(client, org, monkeypatch):
    from app.db import UPLOAD_DIR
    from app.ids import nid
    from app.db import connect
    tid = nid("td")
    chemin = UPLOAD_DIR / f"{tid}.txt"
    chemin.write_text("--- PAGE 1 ---\n" + "Fournir une attestation fiscale valide. " * 20, encoding="utf-8")
    with connect() as conn:
        conn.execute(
            "INSERT INTO tenders(id,org_id,title,buyer,deadline,file_path,text_path,page_count,created_at)"
            " VALUES (?,?,?,?,?,?,?,?,?)", (tid, org, None, None, None, None, str(chemin), 1, "2026-11-25"))
    monkeypatch.setattr(main.ai, "chat_json", lambda s, p, m: ({
        "requirements": [
            {"label": "Attestation fiscale", "page": 1, "excerpt": "Fournir une attestation fiscale valide"},
            {"label": "Garantie inventée", "page": 1, "excerpt": "garantie de 5 millions"},
        ]}, {"model": m, "seconds": 1, "tokens_in": 1, "tokens_out": 1, "cost_fcfa": 0.1}))
    res = client.post(f"/api/tenders/{tid}/requirements")
    assert res.status_code == 200, res.text
    assert res.json()["lecture"]["extraits_introuvables"] == 1
    lignes = {r["label"]: r for r in client.get(f"/api/tenders/{tid}/requirements").json()}
    assert lignes["Attestation fiscale"]["to_check"] == 0
    assert lignes["Garantie inventée"]["to_check"] == 1

    # une correction de l'utilisateur lève le signalement
    rid = lignes["Garantie inventée"]["id"]
    client.patch(f"/api/requirements/{rid}", json={"label": "Garantie"})
    assert client.get(f"/api/tenders/{tid}/requirements").json()[0]["to_check"] in (0, 1)
    assert db_rows("SELECT to_check FROM requirements WHERE id=?", (rid,))[0]["to_check"] == 0


def test_fenetre_modele_coupe_a_une_frontiere_de_page():
    court = "--- PAGE 1 ---\nabc\n--- PAGE 2 ---\ndef"
    assert main._fenetre_modele(court) == (court, False, 2)

    pages = "".join(f"\n--- PAGE {n} ---\n" + "x" * 20_000 for n in range(1, 6))
    envoye, tronque, derniere = main._fenetre_modele(pages)
    assert tronque is True and derniere == 2
    assert len(envoye) <= main.MAX_PROMPT_CHARS
    assert "--- PAGE 3 ---" not in envoye  # jamais de page coupée en deux


def test_extraction_signale_la_troncature(client, org, monkeypatch):
    from app.db import UPLOAD_DIR, connect
    from app.ids import nid
    tid = nid("td")
    chemin = UPLOAD_DIR / f"{tid}.txt"
    chemin.write_text("".join(f"\n--- PAGE {n} ---\n" + "exigence administrative " * 1000
                              for n in range(1, 6)), encoding="utf-8")
    with connect() as conn:
        conn.execute(
            "INSERT INTO tenders(id,org_id,title,buyer,deadline,file_path,text_path,page_count,created_at)"
            " VALUES (?,?,?,?,?,?,?,?,?)", (tid, org, None, None, None, None, str(chemin), 5, "2026-11-25"))
    vu = {}

    def fake(system, prompt, model):
        vu["prompt"] = prompt
        return {"requirements": [{"label": "Attestation", "page": 1}]}, {
            "model": model, "seconds": 1, "tokens_in": 1, "tokens_out": 1, "cost_fcfa": 0.1}

    monkeypatch.setattr(main.ai, "chat_json", fake)
    lecture = client.post(f"/api/tenders/{tid}/requirements").json()["lecture"]
    assert lecture["tronque"] is True
    assert lecture["pages_total"] == 5
    assert 1 <= lecture["derniere_page_lue"] < 5
    assert f"--- PAGE {lecture['derniere_page_lue'] + 1} ---" not in vu["prompt"]

    # la coupure survit au rechargement : elle est relue depuis le dossier, sans appel IA
    relu = client.get(f"/api/tenders/{tid}").json()["lecture"]
    assert relu["tronque"] is True
    assert relu["derniere_page_lue"] == lecture["derniere_page_lue"]
    assert relu["pages_total"] == 5 and relu["source"] == "pdf"


def test_extraction_courte_nest_pas_tronquee(client, tender, monkeypatch):
    monkeypatch.setattr(main.ai, "chat_json", _fake_extraction())
    lecture = client.post(f"/api/tenders/{tender}/requirements").json()["lecture"]
    assert lecture["tronque"] is False


def test_pdf_sans_texte_passe_par_l_ocr_local(monkeypatch):
    from app import extract
    monkeypatch.setattr(extract, "pdf_text", lambda p, max_pages=None, max_chars=None: ("\n--- PAGE 1 ---\n", 84))
    monkeypatch.setattr("app.ocr.pdf_scanned_text",
                        lambda p, n=None: ("\n--- PAGE 1 ---\n" + "texte lu par tesseract " * 10, "fra"))
    texte, pages, ocr_utilise = extract.extract("scan.pdf")
    assert ocr_utilise is True and pages == 84 and "tesseract" in texte


def test_pdf_avec_texte_ne_declenche_pas_l_ocr(monkeypatch):
    from app import extract
    monkeypatch.setattr(extract, "pdf_text",
                        lambda p, max_pages=None, max_chars=None: ("\n--- PAGE 1 ---\n" + "x " * 1000, 1))

    def interdit(*a, **k):
        raise AssertionError("OCR inutile")

    monkeypatch.setattr("app.ocr.pdf_scanned_text", interdit)
    assert extract.extract("natif.pdf")[2] is False


def test_pdf_court_avec_texte_ne_declenche_pas_l_ocr(monkeypatch):
    from app import extract
    # 600 caractères de vrai texte : au-dessus du seuil, appeler tesseract ne servirait à rien
    monkeypatch.setattr(extract, "pdf_text",
                        lambda p, max_pages=None, max_chars=None: ("\n--- PAGE 1 ---\n" + "x " * 300, 1))

    def interdit(*a, **k):
        raise AssertionError("OCR inutile : le PDF a du texte")

    monkeypatch.setattr("app.ocr.pdf_scanned_text", interdit)
    assert extract.extract("natif.pdf")[2] is False


def test_ocr_indisponible_garde_le_texte_du_pdf(monkeypatch):
    from app import extract
    monkeypatch.setattr(extract, "pdf_text", lambda p, max_pages=None, max_chars=None: ("\n--- PAGE 1 ---\nbref", 1))
    monkeypatch.setattr("app.ocr.pdf_scanned_text", lambda p, n=None: ("", ""))
    texte, _pages, ocr_utilise = extract.extract("scan.pdf")
    assert ocr_utilise is False and "bref" in texte


def test_dao_scanne_partiellement_lu_est_signale_tronque(client, org, monkeypatch):
    from app.db import UPLOAD_DIR, connect
    from app.ids import nid
    tid = nid("td")
    chemin = UPLOAD_DIR / f"{tid}.txt"
    chemin.write_text("".join(f"\n--- PAGE {n} ---\n" + "exigence administrative " * 30 for n in range(1, 4)),
                      encoding="utf-8")
    with connect() as conn:
        conn.execute(
            "INSERT INTO tenders(id,org_id,title,buyer,deadline,file_path,text_path,page_count,source,created_at)"
            " VALUES (?,?,?,?,?,?,?,?,?,?)", (tid, org, None, None, None, None, str(chemin), 84, "ocr", "2026-11-25"))
    monkeypatch.setattr(main.ai, "chat_json", lambda s, p, m: ({"requirements": [{"label": "Attestation", "page": 1}]},
                        {"model": m, "seconds": 1, "tokens_in": 1, "tokens_out": 1, "cost_fcfa": 0.1}))
    lecture = client.post(f"/api/tenders/{tid}/requirements").json()["lecture"]
    assert lecture["source"] == "ocr" and lecture["tronque"] is True
    assert lecture["derniere_page_lue"] == 3 and lecture["pages_total"] == 84
