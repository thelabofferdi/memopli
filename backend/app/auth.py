"""Comptes, sessions et contrôle d'appartenance.

Mot de passe : pbkdf2-hmac-sha256, 240 000 itérations, sel par utilisateur.
Jeton : opaque (32 octets), jamais stocké en clair — seule son empreinte
SHA-256 est conservée, ce qui permet une révocation immédiate.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import re
import secrets
import sqlite3

from fastapi import Request

from . import ratelimit
from .config import settings
from .db import connect, rows
from .errors import abort
from .ids import epoch, nid, stamp, today

ITERATIONS = 240_000
MIN_PASSWORD = 8
MAX_PASSWORD = 128
TOKEN_PREFIX = "mpl_"
LOGIN_FAILURES = 5   # tentatives ratées par compte
LOGIN_WINDOW = 900   # fenêtre de compte en secondes
EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,24}$")


# ------------------------------------------------------------------ mots de passe


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, ITERATIONS)
    return "pbkdf2_sha256${}${}${}".format(
        ITERATIONS, base64.b64encode(salt).decode(), base64.b64encode(digest).decode()
    )


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iterations, salt_b64, digest_b64 = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), base64.b64decode(salt_b64), int(iterations)
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(digest, base64.b64decode(digest_b64))


def normalize_email(email: str) -> str:
    """Forme canonique : minuscules, sans espace, sans point final de domaine."""
    mail = (email or "").strip().lower()
    local, at, domain = mail.partition("@")
    if at:
        mail = f"{local}@{domain.rstrip('.')}"
    return mail


def check_credentials(email: str, password: str) -> str:
    mail = normalize_email(email)
    if ".." in mail or not EMAIL_RE.match(mail):
        abort("identifiants_invalides", "adresse e-mail invalide", 400)
    if not MIN_PASSWORD <= len(password) <= MAX_PASSWORD:
        abort("identifiants_invalides",
              f"le mot de passe doit faire entre {MIN_PASSWORD} et {MAX_PASSWORD} caractères", 400)
    return mail


# ------------------------------------------------------------------------ jetons


def _digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_session(user_id: str) -> dict:
    token = TOKEN_PREFIX + secrets.token_urlsafe(32)
    expires = epoch() + settings.session_days * 86_400
    with connect() as conn:
        conn.execute(
            "INSERT INTO sessions(token_hash,user_id,created_at,expires_at,last_seen) VALUES (?,?,?,?,?)",
            (_digest(token), user_id, epoch(), expires, epoch()),
        )
    return {"token": token, "expires_at": expires}


def resolve_session(token: str) -> dict | None:
    digest = _digest(token)
    with connect() as conn:
        found = rows(conn.execute(
            "SELECT s.user_id, s.expires_at, u.email FROM sessions s"
            " JOIN users u ON u.id = s.user_id WHERE s.token_hash=?",
            (digest,),
        ))
        if not found:
            return None
        if found[0]["expires_at"] <= epoch():
            conn.execute("DELETE FROM sessions WHERE token_hash=?", (digest,))
            return None
        # on n'écrit « dernière activité » qu'une fois par minute : pas une écriture par requête
        conn.execute(
            "UPDATE sessions SET last_seen=? WHERE token_hash=? AND COALESCE(last_seen,0) < ?",
            (epoch(), digest, epoch() - 60),
        )
    return {"id": found[0]["user_id"], "email": found[0]["email"]}


def revoke_session(token: str) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM sessions WHERE token_hash=?", (_digest(token),))


def bearer(request: Request) -> str | None:
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    return token.strip()


# ------------------------------------------------------------------- comptes


def create_account(email: str, password: str, org_name: str | None) -> dict:
    mail = check_credentials(email, password)
    with connect() as conn:
        if rows(conn.execute("SELECT id FROM users WHERE email=?", (mail,))):
            abort("compte_existant", "un compte existe déjà avec cette adresse", 409)
        uid = nid("usr")
        try:
            conn.execute(
                "INSERT INTO users(id,email,password_hash,created_at) VALUES (?,?,?,?)",
                (uid, mail, hash_password(password), stamp()),
            )
        except sqlite3.IntegrityError:  # deux inscriptions simultanées sur la même adresse
            abort("compte_existant", "un compte existe déjà avec cette adresse", 409)
        org = None
        if org_name and len(org_name.strip()) >= 2:
            oid = nid("org")
            conn.execute(
                "INSERT INTO organizations(id,user_id,name,ifu,rccm,sector,headcount,created_at)"
                " VALUES (?,?,?,?,?,?,?,?)",
                (oid, uid, org_name.strip(), None, None, None, None, today()),
            )
            org = {"id": oid, "name": org_name.strip()}
    session = create_session(uid)
    return {"user": {"id": uid, "email": mail}, "org": org, **session}


_dummy_hash: str | None = None


def _reference_hash() -> str:
    """Hachage factice : un compte inexistant coûte le même temps qu'un vrai.

    Sans lui, la latence de `/api/auth/login` révèle quelles adresses existent.
    """
    global _dummy_hash
    if _dummy_hash is None:
        _dummy_hash = hash_password("mot-de-passe-de-reference")
    return _dummy_hash


def authenticate(email: str, password: str) -> dict:
    mail = normalize_email(email)
    if settings.rate_limit:
        retry = ratelimit.exceeded("login_account", mail, LOGIN_FAILURES, LOGIN_WINDOW)
        if retry is not None:
            abort("trop_de_requetes",
                  f"trop de tentatives sur ce compte, réessayez dans {retry} s",
                  429, {"Retry-After": str(retry)})
    with connect() as conn:
        found = rows(conn.execute("SELECT id, email, password_hash FROM users WHERE email=?", (mail,)))
    stored = found[0]["password_hash"] if found else _reference_hash()
    correct = verify_password(password, stored)
    # même message dans les deux cas : ne pas révéler si l'adresse existe
    if not found or not correct:
        if settings.rate_limit:
            ratelimit.record("login_account", mail, LOGIN_WINDOW)
        abort("identifiants_invalides", "adresse e-mail ou mot de passe incorrect", 401)
    if settings.rate_limit:
        ratelimit.clear("login_account", mail)
    user = {"id": found[0]["id"], "email": found[0]["email"]}
    return {"user": user, **create_session(user["id"])}


def orgs_of(user_id: str) -> list[dict]:
    with connect() as conn:
        return rows(conn.execute(
            "SELECT id, name, sector FROM organizations WHERE user_id=? ORDER BY created_at",
            (user_id,),
        ))


# -------------------------------------------------------------- appartenance


def optional_user(request: Request) -> dict | None:
    """Dépendance : identifie l'appelant, sans l'exiger si `AUTH_REQUIRED` est faux.

    Un en-tête présent mais invalide ne retombe jamais en anonyme : un client qui
    croit s'authentifier (jeton expiré, faute de frappe) reçoit 401, pas les
    données de tout le monde.
    """
    entete = request.headers.get("authorization", "")
    token = bearer(request)
    if not token:
        if entete.strip():
            abort("non_authentifie", "en-tête Authorization invalide", 401,
                  {"WWW-Authenticate": "Bearer"})
        if settings.auth_required:
            abort("non_authentifie", "authentification requise", 401, {"WWW-Authenticate": "Bearer"})
        return None
    user = resolve_session(token)
    if user is None:
        abort("non_authentifie", "jeton invalide ou expiré", 401, {"WWW-Authenticate": "Bearer"})
    return user


def required_user(request: Request) -> dict:
    """Dépendance : exige un jeton valide, quel que soit le drapeau."""
    token = bearer(request)
    user = resolve_session(token) if token else None
    if user is None:
        abort("non_authentifie", "authentification requise", 401, {"WWW-Authenticate": "Bearer"})
    return user


def assert_access(user: dict | None, *, org_id: str | None = None, tender_id: str | None = None,
                  piece_id: str | None = None, requirement_id: str | None = None) -> None:
    """Un utilisateur n'atteint que les organisations dont il est propriétaire.

    Sans utilisateur (drapeau `AUTH_REQUIRED` éteint), on laisse passer : c'est
    le mode démonstration, documenté dans `docs/10-securite.md`.
    Ressource d'autrui : 404, pour ne pas révéler son existence.
    """
    if user is None:
        return
    target = org_id
    with connect() as conn:
        if target is None and tender_id is not None:
            found = rows(conn.execute("SELECT org_id FROM tenders WHERE id=?", (tender_id,)))
            target = found[0]["org_id"] if found else None
        if target is None and piece_id is not None:
            found = rows(conn.execute("SELECT org_id FROM pieces WHERE id=?", (piece_id,)))
            target = found[0]["org_id"] if found else None
        if target is None and requirement_id is not None:
            found = rows(conn.execute(
                "SELECT t.org_id FROM requirements q JOIN tenders t ON t.id = q.tender_id WHERE q.id=?",
                (requirement_id,),
            ))
            target = found[0]["org_id"] if found else None
        if target is None:
            abort("introuvable", "ressource inconnue", 404)
        owner = rows(conn.execute("SELECT user_id FROM organizations WHERE id=?", (target,)))
    if not owner or owner[0]["user_id"] != user["id"]:
        abort("introuvable", "ressource inconnue", 404)
