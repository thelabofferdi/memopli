import React from "react";
import { dateFr, statusLabel } from "../lib/format.js";
import { Badge, Empty, Section, scrollToId } from "./Ui.jsx";

const HINTS = {
  manquant: "à ajouter dans vos documents",
  perime: "à remplacer dans vos documents",
  a_verifier: "date de fin de validité à indiquer",
};

const LEGEND = [
  ["valide", "date à venir"],
  ["perime", "date passée"],
  ["a_verifier", "pas de date"],
  ["manquant", "aucun document"],
];

export default function Readiness({ verdict, busy, stale, canCheck, onCheck , step }) {
  return (
    <Section
      id="conformite"
      step={step}
      title="Prêt à déposer ?"
      lede="MemoPli associe chaque document demandé à l'un de vos documents, puis contrôle sa date. Un seul document manquant ou expiré suffit à bloquer le dépôt."
      aside={stale && verdict ? <Badge status="a_verifier">à vérifier à nouveau</Badge> : null}
    >
      <ul className="legend" aria-label="Signification des statuts">
        {LEGEND.map(([status, text]) => (
          <li key={status}>
            <Badge status={status}>{statusLabel(status)}</Badge>
            <span>{text}</span>
          </li>
        ))}
      </ul>

      {!canCheck ? (
        <Empty>Relevez d'abord les exigences du dossier : la vérification s'appuie sur elles.</Empty>
      ) : (
        <div className="cta-row">
          <button type="button" onClick={onCheck} disabled={Boolean(busy)}>
            {verdict ? "Vérifier à nouveau" : "Vérifier mon dossier"}
          </button>
          <span className="note">Quelques secondes.</span>
        </div>
      )}

      {verdict && (
        <div className={`verdict ${verdict.ready ? "is-ok" : "is-ko"}`} aria-live="polite">
          <div className="verdict-head">
            <span className="verdict-ico" aria-hidden="true">
              {verdict.ready ? "✓" : "!"}
            </span>
            <div>
              <strong>
                {verdict.ready
                  ? "Prêt à déposer"
                  : `Pas prêt — ${verdict.blockers.length} blocage${verdict.blockers.length > 1 ? "s" : ""}`}
              </strong>
              <span>
                {verdict.checked} document{verdict.checked > 1 ? "s" : ""} demandé{verdict.checked > 1 ? "s" : ""} vérifié{verdict.checked > 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {verdict.blockers.length > 0 && (
            <ul className="blockers">
              {verdict.blockers.map((blocker, index) => (
                <li key={`${blocker.requirement}-${index}`}>
                  <Badge status={blocker.status}>{statusLabel(blocker.status)}</Badge>
                  <div className="blocker-text">
                    <strong>{blocker.requirement}</strong>
                    <span className="meta" title={blocker.reason || ""}>
                      {HINTS[blocker.status] || blocker.reason || "statut inconnu"}
                      {blocker.expires_on ? ` · expiré le ${dateFr(blocker.expires_on)}` : ""}
                    </span>
                  </div>
                  <button type="button" className="ghost small" onClick={() => scrollToId("coffre")}>
                    Voir mes documents
                  </button>
                </li>
              ))}
            </ul>
          )}

          {verdict.ready && (
            <p className="verdict-note">
              Aucun document obligatoire ne manque ni n'est expiré. Le dépôt auprès de l'acheteur se
              fait ensuite de votre côté.
            </p>
          )}
        </div>
      )}
    </Section>
  );
}
