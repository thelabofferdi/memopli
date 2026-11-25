import React, { useRef, useState } from "react";
import { PIECE_KINDS, dateFr, daysLeft, kindLabel, pieceStatus, statusLabel } from "../format.js";
import { Badge, Empty, FileDrop, Section } from "./Ui.jsx";

const EMPTY_ADD = { kind: "attestation_fiscale", label: "", expires_on: "", file: null };

function validityText(piece) {
  if (!piece.expires_on) return "aucune date de fin de validité";
  const days = daysLeft(piece.expires_on);
  const when = dateFr(piece.expires_on);
  if (days === null) return `valable jusqu'au ${when}`;
  if (days < 0) return `expiré depuis le ${when}`;
  if (days <= 30) return `expire le ${when} — dans ${days} j`;
  return `valable jusqu'au ${when}`;
}

export default function Vault({ pieces, busy, onAdd, onRemove, onReplace }) {
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

  return (
    <Section
      id="coffre"
      title="Vos documents"
      lede="Ajoutez chaque document avec sa date de fin de validité. Sans date, il reste « à vérifier » ; une fois expiré, il compte comme manquant."
      aside={
        <span className="note">
          {pieces.length} document{pieces.length > 1 ? "s" : ""}
          {alerts > 0 && <strong className="warn"> · {alerts} à traiter</strong>}
        </span>
      }
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
            placeholder="Ex. Attestation CNSS 2026"
          />
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

      {pieces.length === 0 ? (
        <Empty>
          Aucun document pour l'instant. Ajoutez vos attestations et au moins deux références de
          chantiers : il en faut deux pour rédiger la méthodologie.
        </Empty>
      ) : (
        <ul className="list">
          {pieces.map((piece) => {
            const status = pieceStatus(piece);
            const open = replacing === piece.id;
            return (
              <li key={piece.id} className={open ? "row open" : "row"}>
                <div className="row-main">
                  <span className={`dot ${status}`} aria-hidden="true" />
                  <div>
                    <strong>{piece.label}</strong>
                    <span className="meta">
                      {kindLabel(piece.kind)} · {validityText(piece)}
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
                  <button
                    type="button"
                    className="ghost small danger"
                    disabled={Boolean(busy)}
                    onClick={() => {
                      if (window.confirm(`Retirer « ${piece.label} » de vos documents ?`)) onRemove(piece);
                    }}
                  >
                    Retirer
                  </button>
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
      )}
    </Section>
  );
}
