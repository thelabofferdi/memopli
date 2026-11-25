import React, { useRef, useState } from "react";
import { dateFr, daysLeft, deadlineLabel } from "../lib/format.js";
import { Badge, FileDrop, Section } from "./Ui.jsx";

const NotFound = () => <span className="src-missing">non extrait</span>;

export default function Tender({ tender, requirementsCount, busy, onUpload, onExtract, step = "1" }) {
  const [file, setFile] = useState(null);
  const fileRef = useRef(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return;
    const ok = await onUpload(file);
    if (!ok) return;
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const days = tender?.deadline ? daysLeft(tender.deadline) : null;

  return (
    <Section
      id="dao"
      step={step}
      title="L'appel d'offres"
      lede={
        onUpload
          ? "Déposez le PDF publié par l'acheteur. MemoPli le lit page par page : chaque exigence relevée indiquera la page d'où elle vient."
          : "MemoPli lit le dossier page par page : chaque exigence relevée indiquera la page d'où elle vient."
      }
      aside={
        tender ? (
          <span className="note">
            {tender.page_count} page{tender.page_count > 1 ? "s" : ""} lue{tender.page_count > 1 ? "s" : ""}
            {tender.ocr ? " · document scanné, lu par reconnaissance de texte" : ""}
          </span>
        ) : null
      }
    >
      {onUpload && (
      <form className="form" onSubmit={submit}>
        <div className="field field-wide">
          <span>Dossier d'appel d'offres (PDF)</span>
          <FileDrop
            ref={fileRef}
            file={file}
            onFile={setFile}
            label={tender ? "Choisir un autre dossier" : "Choisir le dossier d'appel d'offres"}
            hint="PDF dont le texte est sélectionnable — ou glissez-le ici"
          />
        </div>
        <div className="form-actions">
          <button type="submit" disabled={Boolean(busy) || !file}>
            {tender ? "Remplacer le dossier" : "Déposer le dossier"}
          </button>
        </div>
      </form>
      )}

      {tender && (
        <>
          <dl className="facts">
            <div className="facts-wide">
              <dt>Marché</dt>
              <dd>{tender.title || <NotFound />}</dd>
            </div>
            <div>
              <dt>Acheteur</dt>
              <dd>{tender.buyer || <NotFound />}</dd>
            </div>
            <div>
              <dt>Date limite de dépôt</dt>
              <dd>
                {tender.deadline ? (
                  <>
                    {dateFr(tender.deadline)}{" "}
                    <Badge status={days !== null && days < 0 ? "perime" : "a_verifier"}>
                      {deadlineLabel(tender.deadline)}
                    </Badge>
                  </>
                ) : (
                  <NotFound />
                )}
              </dd>
            </div>
          </dl>

          <div className="cta-row">
            <button type="button" onClick={onExtract} disabled={Boolean(busy)}>
              {requirementsCount > 0 ? "Relire le dossier" : "Relever les exigences"}
            </button>
            <span className="note">
              {requirementsCount > 0
                ? `${requirementsCount} exigence${requirementsCount > 1 ? "s" : ""} relevée${requirementsCount > 1 ? "s" : ""}. Relire le dossier remplace la liste actuelle, corrections comprises.`
                : "Moins d'une minute pour un dossier de 80 pages."}
            </span>
          </div>
        </>
      )}
    </Section>
  );
}
