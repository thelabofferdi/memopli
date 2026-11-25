import React, { useState } from "react";
import { Badge, Empty, Section, Source } from "./Ui.jsx";

// Pondération : l'extraction la donne en points sur 100 (40) ; d'anciennes données
// l'avaient en fraction (0,4). On affiche toujours un pourcentage.
const pct = (w) => Math.round((w > 1 ? w : w * 100) * 10) / 10;

const blankEdit = (req) => ({
  label: req.label,
  page: req.page ?? "",
  mandatory: Boolean(req.mandatory),
  // le poids est stocké entre 0 et 1, saisi en pourcentage
  weight: req.weight === null || req.weight === undefined ? "" : pct(req.weight),
});

function RequirementRow({ req, edit, busy, onStart, onCancel, onSave, setEdit }) {
  if (edit) {
    const save = (e) => {
      e.preventDefault();
      const page = edit.page === "" ? null : Number(edit.page);
      // le serveur stocke la pondération en points sur 100
      const weight = edit.weight === "" ? null : Number(edit.weight);
      onSave(req.id, {
        label: edit.label.trim() || req.label,
        page: Number.isFinite(page) && page > 0 ? page : null,
        mandatory: edit.mandatory,
        weight: Number.isFinite(weight) ? weight : null,
      });
    };

    return (
      <li className="row editing">
        <form className="form" onSubmit={save}>
          <label className="field field-wide">
            <span>Intitulé de l'exigence</span>
            <input value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} />
          </label>
          <label className="field">
            <span>Page dans le dossier</span>
            <input
              type="number"
              min="1"
              value={edit.page}
              placeholder="non extraite"
              onChange={(e) => setEdit({ ...edit, page: e.target.value })}
            />
          </label>
          {req.kind === "critere" && (
            <label className="field">
              <span>Poids dans la note (%)</span>
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={edit.weight}
                onChange={(e) => setEdit({ ...edit, weight: e.target.value })}
              />
            </label>
          )}
          <label className="field field-check">
            <input
              type="checkbox"
              checked={edit.mandatory}
              onChange={(e) => setEdit({ ...edit, mandatory: e.target.checked })}
            />
            <span>Obligatoire</span>
          </label>
          <div className="form-actions">
            <button type="submit" disabled={Boolean(busy)}>
              Enregistrer
            </button>
            <button type="button" className="ghost" disabled={Boolean(busy)} onClick={onCancel}>
              Annuler
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="row">
      <div className="row-main">
        <div>
          <strong>{req.label}</strong>
          <span className="meta">
            <Source page={req.page} />
            {req.weight ? <span className="weight">{pct(req.weight)} % de la note</span> : null}
            {req.corrected ? <span className="corrected">corrigée par vous</span> : null}
          </span>
          {req.excerpt && <blockquote>{req.excerpt}</blockquote>}
        </div>
      </div>
      <div className="row-side">
        <Badge status={req.mandatory ? "neutre" : "pale"}>
          {req.mandatory ? "obligatoire" : "facultatif"}
        </Badge>
        <button type="button" className="ghost small" disabled={Boolean(busy)} onClick={onStart}>
          Corriger
        </button>
      </div>
    </li>
  );
}

export default function Requirements({ reqs, busy, stale, onCorrect , step }) {
  const [editing, setEditing] = useState(null); // { id, form }

  const pieces = reqs.filter((r) => r.kind === "piece");
  const criteres = reqs.filter((r) => r.kind === "critere");
  const mandatory = reqs.filter((r) => r.mandatory).length;
  const withoutPage = reqs.filter((r) => r.page === null || r.page === undefined).length;

  const handlers = {
    busy,
    onStart: (req) => setEditing({ id: req.id, form: blankEdit(req) }),
    onCancel: () => setEditing(null),
    setEdit: (form) => setEditing({ ...editing, form }),
    onSave: (id, fields) => {
      setEditing(null);
      onCorrect(id, fields);
    },
  };

  const render = (req) => (
    <RequirementRow
      key={req.id}
      req={req}
      busy={handlers.busy}
      edit={editing && editing.id === req.id ? editing.form : null}
      onStart={() => handlers.onStart(req)}
      onCancel={handlers.onCancel}
      onSave={handlers.onSave}
      setEdit={handlers.setEdit}
    />
  );

  return (
    <Section
      id="exigences"
      step={step}
      title="Ce que demande l'acheteur"
      lede="Chaque ligne indique sa page dans le dossier. Une ligne sans page est signalée. Si une ligne est fausse, corrigez-la : votre correction prime."
      aside={
        reqs.length > 0 ? (
          <span className="note">
            {reqs.length} ligne{reqs.length > 1 ? "s" : ""} · {mandatory} obligatoire{mandatory > 1 ? "s" : ""}
            {withoutPage > 0 && <strong className="warn"> · {withoutPage} sans page</strong>}
          </span>
        ) : null
      }
    >
      {reqs.length === 0 ? (
        <Empty>Aucune exigence pour l'instant. Déposez le dossier d'appel d'offres, puis lancez « Relever les exigences ».</Empty>
      ) : (
        <>
          {stale && (
            <p className="callout warn">
              Vous avez modifié une exigence depuis la dernière vérification : vérifiez à nouveau
              votre dossier à l'étape suivante.
            </p>
          )}
          <div className="group">
            <h3>
              Documents demandés <span className="count">{pieces.length}</span>
            </h3>
            {pieces.length ? (
              <ul className="list">{pieces.map(render)}</ul>
            ) : (
              <Empty>Aucun document demandé n'a été trouvé dans ce dossier.</Empty>
            )}
          </div>
          <div className="group">
            <h3>
              Critères de notation <span className="count">{criteres.length}</span>
            </h3>
            {criteres.length ? (
              <ul className="list">{criteres.map(render)}</ul>
            ) : (
              <Empty>Aucun critère de notation trouvé : le dossier ne les contient peut-être pas.</Empty>
            )}
          </div>
        </>
      )}
    </Section>
  );
}
