import React from "react";
import { pieceStatus } from "../format.js";
import { AppChip, Icon, Ring, TINTS } from "./Brand.jsx";
import { Badge } from "./Ui.jsx";

// « Votre dossier type » : les pièces que demandent presque tous les appels
// d'offres, et où vous en êtes. Le statut vient de la même règle que le
// serveur (format.js > pieceStatus) : date passée = expiré, sans date = à vérifier.

const NEEDS = [
  { kind: "attestation_fiscale", label: "Attestation fiscale", count: 1 },
  { kind: "cnss", label: "Attestation CNSS", count: 1 },
  { kind: "rccm", label: "Registre du commerce", count: 1 },
  { kind: "reference", label: "Références de chantiers", count: 2 },
  { kind: "bilan", label: "Bilan", count: 1 },
];

function stateOf(pieces, need) {
  const mine = pieces.filter((p) => p.kind === need.kind);
  const valid = mine.filter((p) => pieceStatus(p) === "valide").length;
  if (valid >= need.count) return { status: "valide", text: `${valid} valide${valid > 1 ? "s" : ""}` };
  if (mine.some((p) => pieceStatus(p) === "perime")) return { status: "perime", text: "expiré" };
  if (mine.length >= need.count) return { status: "a_verifier", text: "sans date de fin" };
  if (mine.length) return { status: "a_verifier", text: `${mine.length} sur ${need.count}` };
  return { status: "manquant", text: "à ajouter" };
}

export default function DocChecklist({ pieces }) {
  const rows = NEEDS.map((n) => ({ ...n, ...stateOf(pieces, n) }));
  const ok = rows.filter((r) => r.status === "valide").length;
  return (
    <section className="panel doccheck">
      <div className="doccheck-head">
        <Ring value={ok / rows.length} size={64} stroke={7} label={`${ok}/${rows.length}`} />
        <div>
          <p className="ph-kicker">Votre dossier type</p>
          <h2>Ce que demandent presque tous les appels d'offres.</h2>
        </div>
      </div>
      <ul className="doccheck-list">
        {rows.map((r) => (
          <li key={r.kind} className={r.status === "valide" ? "ok" : ""}>
            {r.status === "valide" ? (
              <span className="doccheck-ok" aria-hidden="true">
                <Icon name="check" size={14} />
              </span>
            ) : (
              <AppChip tint={TINTS.documents} icon="files" size={26} />
            )}
            <strong>{r.label}</strong>
            <Badge status={r.status}>{r.text}</Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}
