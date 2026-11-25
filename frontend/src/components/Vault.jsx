import React, { useRef, useState } from "react";
import { PIECE_KINDS, dateFr, daysLeft, kindLabel, pieceStatus, statusLabel } from "../lib/format.js";
import { Badge, Empty, FileDrop, Section } from "./Ui.jsx";
import DeleteButton from "./ui/delete-button.tsx";

// L'IA rapproche les documents par leur intitulé (jamais par leur contenu) :
// l'exemple guide vers un intitulé qui dit ce que l'appel d'offres demande.
const PLACEHOLDERS = {
  attestation_fiscale: "Ex. Attestation de régularité fiscale 2026",
  cnss: "Ex. Attestation CNSS 2026",
  rccm: "Ex. Extrait RCCM 2026",
  reference: "Ex. Voirie urbaine, 3,6 km, 985 M FCFA (2024)",
  bilan: "Ex. Bilans 2024-2025 certifiés",
  autre: "Ex. Garantie de soumission 2 %",
};

const EMPTY_ADD = { kind: "attestation_fiscale", label: "", expires_on: "", file: null };

function validityText(piece, deadline) {
  if (!piece.expires_on) return "aucune date de fin de validité";
  const days = daysLeft(piece.expires_on);
  const when = dateFr(piece.expires_on);
  if (days === null) return `valable jusqu'au ${when}`;
  if (days < 0) return `expiré depuis le ${when}`;
  // valable aujourd'hui, mais périmée le jour du dépôt : le dossier la comptera comme manquante
  if (deadline && piece.expires_on < deadline) {
    return `expire le ${when}, avant la date limite du ${dateFr(deadline)}`;
  }
  if (days <= 30) return `expire le ${when} — dans ${days} j`;
  return `valable jusqu'au ${when}`;
}

const FILTERS = [
  ["tous", "Tous"],
  ["traiter", "À traiter"],
  ["valides", "Valides"],
];

// Deux colonnes sur grand écran : à gauche (fixe) le dossier type et l'ajout,
// à droite la liste, qui est ce qu'on consulte le plus. Empilé sur mobile.
export default function Vault({ pieces, busy, onAdd, onRemove, onReplace, side, deadline }) {
  const [filter, setFilter] = useState("tous");
  const [form, setForm] = useState(EMPTY_ADD);
  const [replacing, setReplacing] = useState(null);
  const [replacement, setReplacement] = useState({ expires_on: "", file: null });
  const addFileRef = useRef(null);
  const replaceFileRef = useRef(null);

  const alerts = pieces.filter((p) => pieceStatus(p) !== "valide").length;

  const submit = (e) => {
    e.preventDefault();
    if (!form.label.trim()) return;
    onAdd(form).then((ok) => {
      if (!ok) return;
      setForm(EMPTY_ADD);
      if (addFileRef.current) addFileRef.current.value = "";
    });
  };

  const openReplace = (piece) => {
    setReplacing(piece.id);
    setReplacement({ expires_on: piece.expires_on || "", file: null });
    if (replaceFileRef.current) replaceFileRef.current.value = "";
  };

  const submitReplace = (e) => {
    e.preventDefault();
    const piece = pieces.find((p) => p.id === replacing);
    if (!piece) return;
    onReplace(piece, replacement).then((ok) => {
      if (!ok) return;
      setReplacing(null);
      setReplacement({ expires_on: "", file: null });
      if (replaceFileRef.current) replaceFileRef.current.value = "";
    });
  };

  const shown = pieces.filter((p) =>
    filter === "tous" ? true : filter === "valides" ? pieceStatus(p) === "valide" : pieceStatus(p) !== "valide",
  );
  const counts = { tous: pieces.length, traiter: alerts, valides: pieces.length - alerts };

  return (
    <div className="vault-layout">
      <div className="vault-side">
        {side}
        <Section
          id="ajout"
          title="Ajouter un document"
          lede="Avec sa date de fin de validité : sans date, il reste « à vérifier » ; une fois expiré, il compte comme manquant."
        >
      <form className="form form-add" onSubmit={submit}>
        <label className="field">
          <span>Type</span>
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            {Object.entries(PIECE_KINDS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Nom du document</span>
          <input
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder={PLACEHOLDERS[form.kind] || "Ex. Attestation CNSS 2026"}
          />
          {form.kind === "reference" && (
            <em className="field-hint">Indiquez l'objet et le montant : c'est l'intitulé que MemoPli compare aux exigences.</em>
          )}
        </label>
        <label className="field">
          <span>Valable jusqu'au</span>
          <input type="date" value={form.expires_on} onChange={(e) => setForm({ ...form, expires_on: e.target.value })} />
        </label>
        <div className="field field-wide">
          <span>
            Fichier <small>(facultatif)</small>
          </span>
          <FileDrop ref={addFileRef} file={form.file} onFile={(file) => setForm({ ...form, file })} />
        </div>
        <div className="form-actions">
          <button type="submit" disabled={Boolean(busy) || !form.label.trim()}>
            Ajouter le document
          </button>
        </div>
      </form>
        </Section>
      </div>

      <Section
        id="coffre"
        title="Vos documents"
        aside={
          <span className="note">
            {pieces.length} document{pieces.length > 1 ? "s" : ""}
            {alerts > 0 && <strong className="warn"> · {alerts} à traiter</strong>}
            <button
              type="button"
              className="ghost small vault-jump"
              onClick={() => document.getElementById("ajout")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              + Ajouter
            </button>
          </span>
        }
      >
      {pieces.length > 0 && (
        <div className="vault-filters" role="tablist" aria-label="Filtrer les documents">
          {FILTERS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={filter === k}
              className={filter === k ? "vf on" : "vf"}
              onClick={() => setFilter(k)}
            >
              {label} <span>{counts[k]}</span>
            </button>
          ))}
        </div>
      )}

      {pieces.length === 0 ? (
        <Empty>
          Aucun document pour l'instant. Ajoutez vos attestations et au moins deux références de
          chantiers : il en faut deux pour rédiger la méthodologie.
        </Empty>
      ) : (
        <>
          {deadline && (
            <p className="note">
              Cette page compare les dates à aujourd'hui. Un dossier, lui, juge vos pièces à sa date
              limite de dépôt : celles qui expirent avant le {dateFr(deadline)} y apparaîtront comme
              manquantes.
            </p>
          )}
          <ul className="list">
          {shown.length === 0 && <li className="vault-none">Aucun document dans ce filtre.</li>}
          {shown.map((piece) => {
            const status = pieceStatus(piece);
            const open = replacing === piece.id;
            return (
              <li key={piece.id} className={open ? "row open" : "row"}>
                <div className="row-main">
                  <span className={`dot ${status}`} aria-hidden="true" />
                  <div>
                    <strong>{piece.label}</strong>
                    <span className="meta">
                      {kindLabel(piece.kind)} · {validityText(piece, deadline)}
                    </span>
                  </div>
                </div>
                <div className="row-side">
                  <Badge status={status}>{statusLabel(status)}</Badge>
                  <button
                    type="button"
                    className="ghost small"
                    disabled={Boolean(busy)}
                    onClick={() => (open ? setReplacing(null) : openReplace(piece))}
                  >
                    {open ? "Annuler" : "Remplacer"}
                  </button>
                  <span className="rui" title={`Retirer « ${piece.label} »`}>
                    <DeleteButton onConfirm={() => onRemove(piece)} />
                  </span>
                </div>
                {open && (
                  <form className="form replace" onSubmit={submitReplace}>
                    <p className="note field-wide">
                      Le type et le nom sont conservés. L'ancien document est supprimé et la
                      vérification est relancée.
                    </p>
                    <label className="field">
                      <span>Nouvelle date de fin de validité</span>
                      <input
                        type="date"
                        value={replacement.expires_on}
                        onChange={(e) => setReplacement({ ...replacement, expires_on: e.target.value })}
                      />
                    </label>
                    <div className="field">
                      <span>
                        Nouveau fichier <small>(facultatif)</small>
                      </span>
                      <FileDrop
                        ref={replaceFileRef}
                        file={replacement.file}
                        onFile={(file) => setReplacement({ ...replacement, file })}
                      />
                    </div>
                    <div className="form-actions">
                      <button type="submit" disabled={Boolean(busy)}>
                        Remplacer le document
                      </button>
                    </div>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
        </>
      )}
      </Section>
    </div>
  );
}
