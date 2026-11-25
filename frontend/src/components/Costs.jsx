import React from "react";
import { costLabel, dateFr, number } from "../format.js";
import { Section } from "./Ui.jsx";

const TASKS = {
  extraction: "Lecture de l'appel d'offres",
  rapprochement: "Vérification du dossier",
  redaction: "Rédaction de la méthodologie",
};

// Coût cumulé du dossier, relu depuis le journal du serveur (GET /cost) : il
// survit au rechargement. Le détail technique reste disponible, replié.
export default function Costs({ cost }) {
  const calls = cost?.calls || [];
  if (calls.length === 0) return null;
  const total = cost.totals?.cost_fcfa ?? calls.reduce((s, c) => s + (c.cost_fcfa || 0), 0);

  return (
    <Section id="cout" title="Coût de l'analyse" aside={<strong className="cost-total">{costLabel(total)}</strong>}>
      <ul className="list costs">
        {calls.map((call, index) => (
          <li className="row" key={`${call.created_at}-${index}`}>
            <span>
              {TASKS[call.task] || call.task}
              {!call.ok && <span className="badge badge-perime cost-ko">échec</span>}
            </span>
            <strong>{costLabel(call.cost_fcfa || 0)}</strong>
          </li>
        ))}
      </ul>
      <details className="tech">
        <summary>Détail technique</summary>
        <ul>
          {calls.map((call, index) => (
            <li key={`${call.created_at}-${index}`}>
              {TASKS[call.task] || call.task} — {call.model || "modèle inconnu"} · {call.seconds ?? "?"} s ·{" "}
              {number(call.tokens_in || 0)} + {number(call.tokens_out || 0)} jetons · {dateFr(call.created_at)}
            </li>
          ))}
        </ul>
      </details>
    </Section>
  );
}
