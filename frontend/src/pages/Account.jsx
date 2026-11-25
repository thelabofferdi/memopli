import React from "react";
import { Section } from "../components/Ui.jsx";
import { PageHead } from "../components/brand/Brand.jsx";

export default function Account({ user, org, onSignOut }) {
  return (
    <>
      <PageHead
        kicker="Mon compte"
        title="Votre connexion."
        sub="Les informations de connexion à votre espace MemoPli."
        tip="Vos dossiers et vos documents restent enregistrés, même après déconnexion."
      />

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
