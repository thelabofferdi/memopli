"""Garde-fous issus de la relecture adverse : fail-closed, corps chunked, plafonds réels."""
from __future__ import annotations

import pytest

from app import config, extract, main, ratelimit
from app.config import settings
from tests.conftest import add_requirement, db_rows, make_tender


def test_jeton_invalide_ne_retombe_pas_en_anonyme(client, org):
    res = client.get(f"/api/pieces?org_id={org}", headers={"Authorization": "Bearer mpl_inexistant"})
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "non_authentifie"
    assert res.headers["WWW-Authenticate"] == "Bearer"


def test_entete_authorization_malforme_refuse(client, org):
    for entete in ("Basic abc", "Bearer", "mpl_sans_schema"):
        res = client.get(f"/api/pieces?org_id={org}", headers={"Authorization": entete})
        assert res.status_code == 401, entete


def test_sans_entete_le_mode_demo_reste_ouvert(client, org):
    assert client.get(f"/api/pieces?org_id={org}").status_code == 200


def test_corps_chunked_plafonne(client):
    def flux():
        for _ in range(300):  # 30 Mo, sans Content-Length
            yield b"x" * 100_000

    res = client.post("/api/auth/login", content=flux(), headers={"content-type": "application/json"})
    assert res.status_code == 413
    assert res.json()["error"]["code"] == "fichier_trop_lourd"


def test_petit_corps_chunked_accepte(client):
    def flux():
        yield b'{"email":"a@b.co",'
        yield b'"password":"motdepasse"}'

    res = client.post("/api/auth/login", content=flux(), headers={"content-type": "application/json"})
    assert res.status_code == 401  # le corps est bien lu, seul le compte est inconnu


def test_plafond_de_pages_verifie_avant_extraction(monkeypatch):
    import pypdf

    class Page:
        def extract_text(self):  # pragma: no cover - ne doit jamais être appelé
            raise AssertionError("aucune page ne doit être extraite avant le contrôle du plafond")

    class Lecteur:
        def __init__(self, _path):
            self.pages = [Page() for _ in range(5)]

    monkeypatch.setattr(pypdf, "PdfReader", Lecteur)
    with pytest.raises(extract.PdfTooLong):
        extract.pdf_text("faux.pdf", max_pages=2)


def test_extraction_non_conforme_ne_recopie_pas_le_modele(client, tender, monkeypatch):
    secret = "montant confidentiel 4 782 000 FCFA"
    monkeypatch.setattr(main.ai, "chat_json", lambda s, p, m: ({"deadline": 42, "requirements": secret}, {}))
    res = client.post(f"/api/tenders/{tender}/requirements")
    assert res.status_code == 502
    assert res.json()["error"]["code"] == "extraction_invalide"
    assert secret not in res.text
    assert "input_value" not in res.text


def test_tentatives_par_compte_plafonnees(client):
    from tests.test_auth import MOT_DE_PASSE, _inscription

    body = _inscription(client)
    settings.rate_limit = True
    settings.rate_auth_per_minute = 100  # on isole le compteur par compte
    try:
        codes = [
            client.post("/api/auth/login",
                        json={"email": body["user"]["email"], "password": "faux"}).status_code
            for _ in range(6)
        ]
    finally:
        settings.rate_limit = False
        settings.rate_auth_per_minute = 10
    assert codes[:5] == [401] * 5
    assert codes[5] == 429


def test_email_avec_point_final_est_le_meme_compte(client):
    from tests.test_auth import MOT_DE_PASSE

    email = "dup-point@corp.bj"
    assert client.post("/api/auth/signup", json={"email": email, "password": MOT_DE_PASSE}).status_code == 200
    res = client.post("/api/auth/signup", json={"email": email + ".", "password": MOT_DE_PASSE})
    assert res.status_code == 409


def test_patch_peut_effacer_un_champ_nullable(client, tender):
    rid = add_requirement(tender)
    client.patch(f"/api/requirements/{rid}", json={"page": 3, "weight": 20})
    res = client.patch(f"/api/requirements/{rid}", json={"page": None})
    assert res.status_code == 200
    ligne = db_rows("SELECT page FROM requirements WHERE id=?", (rid,))[0]
    assert ligne["page"] is None


def test_patch_refuse_de_vider_un_champ_obligatoire(client, tender):
    rid = add_requirement(tender)
    res = client.patch(f"/api/requirements/{rid}", json={"label": None})
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "rien_a_modifier"


def test_route_api_inconnue_repond_json(client):
    res = client.get("/api/un/chemin/tres/profond")
    assert res.status_code == 404
    assert res.headers["content-type"].startswith("application/json")
    assert res.json()["error"]["code"] == "introuvable"


def test_hote_avec_arobase_refuse(client):
    res = client.get("/health", headers={"host": "127.0.0.1:8000@evil.example"})
    assert res.status_code == 400


def test_eviction_lru_ne_remet_pas_les_compteurs_a_zero(monkeypatch):
    ratelimit.reset()
    monkeypatch.setattr(ratelimit, "MAX_BUCKETS", 2)
    ratelimit.record("essai", "a", 60)
    ratelimit.record("essai", "a", 60)
    ratelimit.record("essai", "b", 60)
    assert ratelimit.exceeded("essai", "a", 2, 60) is not None
    ratelimit.record("essai", "c", 60)  # évince b, le plus ancien, et rien d'autre
    assert ratelimit.exceeded("essai", "a", 2, 60) is not None


def test_ip_invalide_regroupee(monkeypatch):
    assert ratelimit._normalize_ip("1.2.3.4") == "1.2.3.4"
    assert ratelimit._normalize_ip("1.2.3.4:5678") == "1.2.3.4"
    assert ratelimit._normalize_ip("::1") == "::1"
    assert ratelimit._normalize_ip('"); DROP') == "inconnu"


def test_prod_refuse_de_demarrer_ouvert(monkeypatch):
    monkeypatch.setattr(settings, "app_env", "prod")
    monkeypatch.setattr(settings, "auth_required", False)
    with pytest.raises(RuntimeError, match="AUTH_REQUIRED"):
        config.enforce()
    monkeypatch.setattr(settings, "auth_required", True)
    monkeypatch.setattr(settings, "cors_origins", ["*"])
    with pytest.raises(RuntimeError, match="CORS_ORIGIN"):
        config.enforce()


def test_docs_fermees_par_defaut(monkeypatch):
    monkeypatch.delenv("DOCS_ENABLED", raising=False)
    assert config.Settings().docs_enabled is False


def test_plafond_texte_respecte(monkeypatch):
    import pypdf

    class Page:
        def extract_text(self):
            return "z" * 5000

    class Lecteur:
        def __init__(self, _path):
            self.pages = [Page() for _ in range(10)]

    monkeypatch.setattr(pypdf, "PdfReader", Lecteur)
    texte, pages = extract.pdf_text("faux.pdf", max_pages=10, max_chars=20_000)
    assert pages == 10
    assert 20_000 <= len(texte) < 30_000  # arrêt dès le plafond, sans lire les 10 pages


def test_dao_sans_texte_est_signale(client, org):
    tid = make_tender(org)
    from app.db import connect

    with connect() as conn:
        conn.execute("UPDATE tenders SET text_path=NULL WHERE id=?", (tid,))
    res = client.post(f"/api/tenders/{tid}/requirements")
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "texte_insuffisant"
