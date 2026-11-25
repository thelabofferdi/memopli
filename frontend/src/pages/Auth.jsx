import React, { useState } from "react";
import * as api from "../api.js";
import { Mark, Wordmark } from "../components/Logo.jsx";
import Mascot from "../components/Mascot.jsx";
import { errorText } from "../format.js";
import { navigate } from "../router.js";

const MESSAGES = {
  identifiants_invalides: "Adresse e-mail ou mot de passe incorrect.",
  compte_existant: "Un compte existe déjà avec cette adresse. Connectez-vous plutôt.",
  trop_de_requetes: null, // le message du serveur donne le délai d'attente
};

function nextFrom(path) {
  const query = path.split("?")[1] || "";
  const next = new URLSearchParams(query).get("suite");
  return next && next.startsWith("/app") ? next : "/app";
}

export default function Auth({ mode, path }) {
  const signup = mode === "signup";
  const [form, setForm] = useState({ email: "", password: "", org_name: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(form.email.trim());
  const passwordOk = signup ? form.password.length >= 8 : form.password.length > 0;
  const orgOk = !signup || form.org_name.trim().length >= 2;
  const valid = emailOk && passwordOk && orgOk;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = signup
        ? await api.signup({ email: form.email.trim(), password: form.password, org_name: form.org_name.trim() })
        : await api.login({ email: form.email.trim(), password: form.password });
      api.session.set(res.token);
      navigate(signup ? "/app/entreprise?bienvenue=1" : nextFrom(path), { replace: true });
    } catch (err) {
      setError(MESSAGES[err.code] || errorText(err));
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <aside className="auth-side">
        <a className="auth-brand" href="#/" aria-label="MemoPli, accueil">
          <Mark size={32} variant="paper" />
          <Wordmark />
        </a>
        <div className="auth-pitch">
          <p className="auth-kicker">Le poste de travail des appels d'offres</p>
          <h2>Ne repartez plus de zéro à chaque appel d'offres.</h2>
          <ul>
            <li>Chaque exigence avec sa page</li>
            <li>Aucun document expiré ne passe</li>
            <li>La méthodologie écrite avec vos chantiers</li>
          </ul>
        </div>
        <div className="auth-pli" aria-hidden="true">
          <Mascot size={180} />
        </div>
      </aside>

      <main className="auth-main">
        <a className="auth-back" href="#/">
          ← Retour à l'accueil
        </a>
        <div className="auth-card">
          <a className="auth-brand auth-brand-mobile" href="#/" aria-label="MemoPli, accueil">
            <Mark size={30} />
            <Wordmark />
          </a>
          <h1>{signup ? "Créer votre compte" : "Bon retour parmi nous"}</h1>
          <p className="auth-sub">
            {signup
              ? "Deux minutes pour commencer. Vous compléterez votre entreprise ensuite."
              : "Connectez-vous pour retrouver vos dossiers et vos documents."}
          </p>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <form className="auth-form" onSubmit={submit} noValidate>
            {signup && (
              <label className="field">
                <span>Nom de l'entreprise</span>
                <input
                  value={form.org_name}
                  onChange={set("org_name")}
                  placeholder="Ex. Entreprise Adjovi BTP"
                  autoComplete="organization"
                  autoFocus
                />
              </label>
            )}
            <label className="field">
              <span>Adresse e-mail</span>
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="vous@entreprise.bj"
                autoComplete="email"
                autoFocus={!signup}
              />
            </label>
            <label className="field">
              <span>Mot de passe</span>
              <span className="pw">
                <input
                  type={show ? "text" : "password"}
                  value={form.password}
                  onChange={set("password")}
                  placeholder={signup ? "8 caractères minimum" : "Votre mot de passe"}
                  autoComplete={signup ? "new-password" : "current-password"}
                />
                <button type="button" className="pw-toggle" onClick={() => setShow((v) => !v)}>
                  {show ? "Masquer" : "Afficher"}
                </button>
              </span>
              {signup && form.password.length > 0 && form.password.length < 8 && (
                <em className="field-hint">Encore {8 - form.password.length} caractère{8 - form.password.length > 1 ? "s" : ""}.</em>
              )}
            </label>

            <button type="submit" className="auth-submit" disabled={!valid || busy}>
              {busy ? <span className="spinner" aria-hidden="true" /> : null}
              {signup ? "Créer mon compte" : "Se connecter"}
            </button>
          </form>

          <p className="auth-switch">
            {signup ? (
              <>
                Déjà un compte ? <a href="#/connexion">Se connecter</a>
              </>
            ) : (
              <>
                Pas encore de compte ? <a href="#/inscription">Créer un compte</a>
              </>
            )}
          </p>
          {!signup && (
            <p className="auth-foot">Mot de passe oublié ? Écrivez-nous depuis l'adresse de votre compte.</p>
          )}
        </div>
      </main>
    </div>
  );
}
