"""Configuration : une valeur invalide échoue au démarrage, pas au milieu d'un appel."""
from __future__ import annotations

import re
from pathlib import Path

import pytest

from app import config

RACINE = Path(config.__file__).resolve().parents[2]


def _env_example() -> dict[str, str]:
    texte = (RACINE / ".env.example").read_text(encoding="utf-8")
    return dict(re.findall(r"^([A-Z_]+)=(.*)$", texte, re.M))


def test_env_example_documente_toutes_les_variables():
    source = (RACINE / "backend/app/config.py").read_text(encoding="utf-8")
    lues = set(re.findall(r'(?:_int|_bool|_float|_list|getenv)\("([A-Z_]+)"', source)) - {"ENV_FILE"}
    absentes = lues - set(_env_example())
    assert not absentes, f"absentes de .env.example : {sorted(absentes)}"


def test_env_example_reprend_les_modeles_par_defaut():
    exemple = _env_example()
    reglages = config.Settings()
    assert exemple["MODEL_EXTRACT"] == reglages.model_extract
    assert exemple["MODEL_MATCH"] == reglages.model_match
    assert exemple["MODEL_DRAFT"] == reglages.model_draft
    assert exemple["MODEL_CHAT"] == reglages.model_chat
    assert exemple["MODEL_OCR"] == reglages.model_ocr


def test_env_example_sans_cle():
    assert _env_example()["RODIUM_API_KEY"] == ""


def test_plafond_non_entier_refuse(monkeypatch):
    monkeypatch.setenv("MAX_UPLOAD_MB", "vingt")
    with pytest.raises(RuntimeError, match="MAX_UPLOAD_MB"):
        config.Settings()


def test_plafond_hors_bornes_refuse(monkeypatch):
    monkeypatch.setenv("MAX_UPLOAD_MB", "5000")
    with pytest.raises(RuntimeError, match="entre 1 et 200"):
        config.Settings()


def test_drapeau_non_booleen_refuse(monkeypatch):
    monkeypatch.setenv("AUTH_REQUIRED", "peut-etre")
    with pytest.raises(RuntimeError, match="AUTH_REQUIRED"):
        config.Settings()


def test_defauts_surs():
    reglages = config.Settings()
    assert reglages.auth_required is False
    assert "http://127.0.0.1:5173" in reglages.cors_origins
    assert reglages.body_limit == reglages.max_upload_mb * 1024 * 1024 + 1024 * 1024


def test_avertissements_de_demarrage():
    avertissements = config.check()
    assert any("AUTH_REQUIRED=false" in a for a in avertissements)
    assert any("RODIUM_API_KEY" in a for a in avertissements)


def test_resume_sans_secret():
    resume = config.describe()
    assert "cle_ia" in resume
    assert all("sk-" not in str(valeur) for valeur in resume.values())
