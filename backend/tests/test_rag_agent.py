"""Ingestion, recherche BM25, agent et lecture de la réponse du modèle.

Ces tests ne sortent jamais sur le réseau : le modèle est remplacé par une fonction
qui capture ce qu'on lui envoie. C'est ce qui permet de vérifier la règle la plus
coûteuse à tenir — les pièces de l'entreprise n'entrent jamais dans une requête.
"""
from __future__ import annotations

import json

import pytest

from app import ai, ingest, ocr, rag
from app.schemas import RequirementIn, dedupe, iso_date, normalize_extract
from conftest import db_rows

TEXTE = """--- PAGE 1 ---
Avis d'appel d'offres ouvert. Date limite de dépôt : 18 décembre 2026 à dix heures.
--- PAGE 2 ---
Pièces administratives : attestation fiscale de moins de trois mois.
--- PAGE 3 ---
Garantie de soumission de deux pour cent, soit 25 000 000 FCFA.

""" + "Clause de confidentialité. " * 20

SECRET = "IBAN du compte de l'entreprise, ne doit jamais partir au modèle"


# ------------------------------------------------------------------ découpage

def test_chunk_pages_ne_melange_jamais_deux_pages():
    morceaux = ingest.chunk_pages(TEXTE)
    assert {m["page"] for m in morceaux} == {1, 2, 3}
    par_page = {}
    for m in morceaux:
        assert "--- PAGE" not in m["text"]
        par_page.setdefault(m["page"], []).append(m["text"])
    assert "18 décembre 2026" in " ".join(par_page[1])
    assert "25 000 000 FCFA" in " ".join(par_page[3])
    for page, blocs in par_page.items():
        autre = {p: t for p, t in par_page.items() if p != page}
        for texte in blocs:
            for contenu in autre.values():
                assert contenu[0][:30] not in texte


def test_chunk_pages_respecte_la_taille_demandee():
    morceaux = ingest.chunk_pages(TEXTE, size=80)
    assert len(morceaux) > 3
    assert all(len(m["text"]) <= 80 for m in morceaux)


def test_register_est_idempotent_par_source(org, tender):
    premier = ingest.register(org_id=org, kind="dao", filename="dao.pdf", mime="application/pdf",
                              size_bytes=10, pages=3, text=TEXTE, tender_id=tender)
    second = ingest.register(org_id=org, kind="dao", filename="dao.pdf", mime="application/pdf",
                             size_bytes=10, pages=3, text=TEXTE, tender_id=tender)
    assert premier["id"] != second["id"]
    assert len(ingest.list_documents(org, tender)) == 1  # l'ancien index est remplacé


# ------------------------------------------------------------------ recherche

def test_recherche_trouve_la_page_et_cloisonne_les_entreprises(client, org, tender):
    autre = client.post("/api/orgs", json={"name": "Autre entreprise"}).json()["id"]
    ingest.register(org_id=org, kind="dao", filename="dao.pdf", mime="application/pdf",
                    size_bytes=10, pages=3, text=TEXTE, tender_id=tender)

    trouves = rag.search(org, "garantie de soumission", k=3, tender_id=tender)
    assert trouves, "la recherche doit trouver la page qui parle de la garantie"
    assert trouves[0]["page"] == 3
    assert trouves[0]["score"] > 0

    assert rag.search(autre, "garantie de soumission") == []
    assert rag.search(org, "terme totalement absent du dossier") == []


def test_recherche_rend_le_texte_entier_au_modele_et_un_extrait_court(org, tender):
    ingest.register(org_id=org, kind="dao", filename="dao.pdf", mime="application/pdf",
                    size_bytes=10, pages=3, text=TEXTE, tender_id=tender)
    trouve = rag.search(org, "confidentialité", k=1, tender_id=tender)[0]
    assert len(trouve["extrait"]) <= 400
    assert len(trouve["text"]) > 400
    assert trouve["extrait"] == trouve["text"][:400]


# ---------------------------------------------------------------------- agent

def test_agent_cite_les_pages_et_nenvoie_jamais_les_pieces(client, org, tender, monkeypatch):
    from app import agent

    ingest.register(org_id=org, kind="dao", filename="dao.pdf", mime="application/pdf",
                    size_bytes=10, pages=3, text=TEXTE, tender_id=tender)
    piece = client.post("/api/pieces", data={"org_id": org, "kind": "attestation_fiscale",
                                            "label": "Attestation fiscale 2026"})
    assert piece.status_code == 200
    ingest.register(org_id=org, kind="piece", filename="piece.pdf", mime="application/pdf",
                    size_bytes=10, pages=1, text=SECRET, piece_id=piece.json()["id"])

    envoye = {}

    def faux_chat_messages(messages, modele=None, **kwargs):
        envoye["messages"] = messages
        envoye["modele"] = modele
        return "La garantie de soumission est de 25 000 000 FCFA [p.3].", {
            "model": modele, "tokens_in": 10, "tokens_out": 5, "seconds": 0.1, "cost_fcfa": 1.0,
        }

    monkeypatch.setattr(ai, "chat_messages", faux_chat_messages)
    reponse = agent.answer(org, "Quel est le montant de la garantie de soumission ?", tender)

    invite = json.dumps(envoye["messages"], ensure_ascii=False)
    assert "[p.3]" in invite, "le contexte envoyé doit porter le numéro de page"
    assert "25 000 000 FCFA" in invite
    assert SECRET not in invite, "le contenu d'une pièce ne doit jamais partir au modèle"
    assert reponse["contexte"]["pieces_envoyees"] == 0
    assert [c["page"] for c in reponse["citations"]]
    assert reponse["answer"].endswith("[p.3].")

    historique = agent.history(org, tender)
    assert [m["role"] for m in historique][-2:] == ["user", "assistant"]


def test_agent_repond_sans_extrait_plutot_que_dinventer(org, tender, monkeypatch):
    from app import agent

    def faux_chat_messages(messages, modele=None, **kwargs):
        return "le dossier ne le dit pas", {"model": modele, "seconds": 0.1, "cost_fcfa": 0.5}

    monkeypatch.setattr(ai, "chat_messages", faux_chat_messages)
    reponse = agent.answer(org, "Quel est le numéro de téléphone du maître d'ouvrage ?", tender)
    assert "le dossier ne le dit pas" in reponse["answer"]
    assert reponse["citations"] == []


# --------------------------------------------------- lecture de la sortie du modèle

def test_dates_lues_en_francais_deviennent_iso():
    assert iso_date("18 décembre 2026") == "2026-12-18"
    assert iso_date("1er février 2027") == "2027-02-01"
    assert iso_date("18/12/2026") == "2026-12-18"
    assert iso_date("2026-12-18") == "2026-12-18"
    assert iso_date("courant décembre") is None
    assert iso_date("31 février 2026") is None


def test_normalize_extract_accepte_les_variantes_du_modele():
    brut = {
        "titre": "Réhabilitation de voirie",
        "maître_ouvrage": "Mairie de Cotonou",
        "date_limite": "18 décembre 2026",
        "requirements": [
            {"name": "Attestation fiscale", "type": "pièce administrative", "page": 3},
            {"label": "Page inventée", "page": 99},
            "Références de marchés similaires",
            {"autre": "sans intitulé exploitable"},
        ],
        "grid": [{"name": "Prix", "pondération": "40 points", "page": 4}],
    }
    parsed, lecture = normalize_extract(brut, page_count=6)

    assert parsed.title == "Réhabilitation de voirie"
    assert parsed.buyer == "Mairie de Cotonou"
    assert parsed.deadline == "2026-12-18"
    assert [r.label for r in parsed.requirements][:2] == ["Attestation fiscale",
                                                          "Page inventée"]
    assert parsed.requirements[0].kind == "piece"
    assert parsed.requirements[1].page is None  # page hors document : perdue, jamais inventée
    assert lecture["pages_hors_document"] == 1
    assert lecture["ignorees"] == 1
    assert parsed.grid[0].kind == "critere"
    assert parsed.grid[0].weight == 40.0


def test_normalize_extract_refuse_une_reponse_sans_exigence():
    with pytest.raises(ValueError):
        normalize_extract({"title": "Dossier vide", "requirements": []})
    with pytest.raises(ValueError):
        normalize_extract(["pas un objet"])


def test_dedupe_ne_garde_quune_fois_la_meme_grille():
    items = [
        RequirementIn(label="Prix des prestations", kind="critere", page=4, weight=40),
        RequirementIn(label="Prix  des prestations", kind="critere", page=4, weight=40),
        RequirementIn(label="Prix des prestations", kind="piece", page=3),
    ]
    uniques, doublons = dedupe(items)
    assert doublons == 1
    assert len(uniques) == 2


# ------------------------------------------------------------------ documents et photo

def test_documents_indexes_par_entreprise(client, org, tender):
    ingest.register(org_id=org, kind="dao", filename="dao.pdf", mime="application/pdf",
                    size_bytes=10, pages=3, text=TEXTE, tender_id=tender)
    res = client.get("/api/documents", params={"org_id": org})
    assert res.status_code == 200
    corps = res.json()
    assert corps["documents"][0]["chunks"] >= 1
    assert corps["index"]["morceaux"] >= 1
    assert "tesseract" in corps["ocr"]


PNG_1x1 = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00"
    b"\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4"
    b"\x00\x00\x00\x00IEND\xaeB`\x82"
)


def test_photo_de_piece_acceptee_et_indexee(client, org):
    res = client.post("/api/pieces",
                      data={"org_id": org, "kind": "attestation_fiscale",
                            "label": "Attestation fiscale photographiée",
                            "expires_on": "2027-02-12"},
                      files={"file": ("photo.png", PNG_1x1, "image/png")})
    assert res.status_code == 200, res.text
    document = res.json()["document"]
    assert document["pages"] == 1
    # tesseract absent ou image vide : le statut le dit, aucune invention
    assert document["status"] in {"ingere", "texte_absent"}
    liste = client.get("/api/documents", params={"org_id": org}).json()["documents"]
    photo = next(d for d in liste if d["piece_id"])
    assert photo["kind"] == "photo"


def test_photo_refusee_si_ce_nest_pas_une_image(client, org):
    res = client.post("/api/pieces",
                      data={"org_id": org, "kind": "autre", "label": "Faux document"},
                      files={"file": ("note.txt", b"ceci est un texte", "text/plain")})
    assert res.status_code == 415
    assert res.json()["error"]["code"] == "format_non_supporte"


def test_etiquette_ocr_dit_quelle_langue_a_servi():
    assert ocr._etiquette("eng", "fra", False) == "eng (modèle fra absent)"
    assert ocr._etiquette("fra", "fra", True) == "fra"
