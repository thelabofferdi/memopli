"""Configuration : une valeur invalide échoue au démarrage, pas au milieu d'un appel."""
from __future__ import annotations

import pytest

from app import config


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
