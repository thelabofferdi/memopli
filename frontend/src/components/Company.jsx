import React, { useEffect, useState } from "react";
import { dateFr } from "../lib/format.js";
import { Section } from "./Ui.jsx";

const toForm = (org) => ({
  name: org?.name || "",
  ifu: org?.ifu || "",
  rccm: org?.rccm || "",
  sector: org?.sector || "",
  headcount: org?.headcount ?? "",
});

const clean = (form) => ({
  name: form.name.trim(),
  ifu: form.ifu.trim() || null,
  rccm: form.rccm.trim() || null,
  sector: form.sector.trim() || null,
  headcount: form.headcount === "" ? null : Number(form.headcount),
});

/** Profil de l'entreprise : création (org absente) ou modification. */
export default function Company({ org, busy, onSave, startEditing = false }) {
  const [editing, setEditing] = useState(!org || startEditing);
  const [form, setForm] = useState(toForm(org));
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    setForm(toForm(org));
  }, [org]);

  const set = (key) => (e) => {
    setTouched(true);
    setForm({ ...form, [key]: e.target.value });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.name.trim().length < 2) {
      setTouched(true);
      return;
    }
    const ok = await onSave(clean(form));
    if (ok && org) setEditing(false);
  };

  const missing = <span className="muted">non renseigné</span>;

  if (org && !editing) {
    return (
      <Section
        id="entreprise"
        title="Votre entreprise"
        aside={
          <button type="button" className="ghost small" onClick={() => setEditing(true)}>
            Modifier
          </button>
        }
      >
        <dl className="facts">
          <div className="facts-wide">
            <dt>Nom de l'entreprise</dt>
            <dd>{org.name}</dd>
          </div>
          <div>
            <dt>Numéro fiscal (IFU)</dt>
            <dd>{org.ifu || missing}</dd>
          </div>
          <div>
            <dt>Registre du commerce</dt>
            <dd>{org.rccm || missing}</dd>
          </div>
          <div>
            <dt>Secteur</dt>
            <dd>{org.sector || missing}</dd>
          </div>
          <div>
            <dt>Effectif</dt>
            <dd>{org.headcount ?? missing}</dd>
          </div>
        </dl>
        {org.created_at && <p className="note">Créée le {dateFr(org.created_at)}.</p>}
      </Section>
    );
  }

  const nameError = touched && form.name.trim().length < 2;

  return (
    <Section
      id="entreprise"
      title="Votre entreprise"
      lede="Saisies une seule fois, ces informations sont reprises dans chacun de vos dossiers."
    >
      <form className="form" onSubmit={submit} noValidate>
        <label className="field field-wide">
          <span>Nom de l'entreprise</span>
          <input
            value={form.name}
            onChange={set("name")}
            placeholder="Ex. Entreprise Adjovi BTP"
            aria-invalid={nameError || undefined}
          />
          {nameError && <em className="field-error">Le nom doit contenir au moins deux caractères.</em>}
        </label>
        <label className="field">
          <span>
            Numéro fiscal <small>(IFU, NIF…)</small>
          </span>
          <input value={form.ifu} onChange={set("ifu")} placeholder="Facultatif" />
        </label>
        <label className="field">
          <span>
            Registre du commerce <small>(RCCM)</small>
          </span>
          <input value={form.rccm} onChange={set("rccm")} placeholder="Facultatif" />
        </label>
        <label className="field">
          <span>Secteur</span>
          <input value={form.sector} onChange={set("sector")} placeholder="Ex. Bâtiment, travaux publics" />
        </label>
        <label className="field">
          <span>Effectif</span>
          <input type="number" min="0" value={form.headcount} onChange={set("headcount")} placeholder="Ex. 24" />
        </label>
        <div className="form-actions">
          {org && (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setForm(toForm(org));
                setEditing(false);
              }}
            >
              Annuler
            </button>
          )}
          <button type="submit" disabled={Boolean(busy) || form.name.trim().length < 2}>
            Enregistrer
          </button>
        </div>
      </form>
    </Section>
  );
}
