import React from "react";
import { Section } from "../components/Ui.jsx";

export default function Account({ user, org, onSignOut }) {
  return (
    <>
      <header className="page-head">
        <h1>Mon compte</h1>
        <p>Les informations de connexion à votre espace MemoPli.</p>
      </header>

      <Section id="compte" title="Connexion">
        <dl className="facts">
          <div className="facts-wide">
            <dt>Adresse e-mail</dt>
            <dd>{user?.email || "…"}</dd>
          </div>
          <div>
            <dt>Entreprise</dt>
            <dd>{org?.name || "aucune"}</dd>
          </div>
          <div>
            <dt>Mot de passe</dt>
            <dd>••••••••</dd>
          </div>
        </dl>
        <p className="note">
          Pour changer de mot de passe ou d'adresse, écrivez-nous depuis l'adresse de votre compte.
        </p>
      </Section>

      <Section id="session" title="Session">
        <div className="cta-row">
          <button type="button" className="ghost" onClick={onSignOut}>
            Se déconnecter
          </button>
          <span className="note">Vos dossiers et vos documents restent enregistrés.</span>
        </div>
      </Section>
    </>
  );
}
