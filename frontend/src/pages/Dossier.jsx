import React, { useCallback, useEffect, useState } from "react";
import * as api from "../api.js";
import Costs from "../components/Costs.jsx";
import Draft from "../components/Draft.jsx";
import Readiness from "../components/Readiness.jsx";
import Requirements from "../components/Requirements.jsx";
import Tender from "../components/Tender.jsx";
import { Empty, Section, Stepper } from "../components/Ui.jsx";
import { pieceStatus } from "../format.js";

// Un dossier d'appel d'offres : lecture, exigences, contrôle des documents,
// verdict, rédaction. Les statuts viennent du serveur ; l'écran ne fait que
// les afficher (le code calcule, l'IA lit).

export default function Dossier({ tenderId, pieces, busy, run }) {
  const [tender, setTender] = useState(null);
  const [missing, setMissing] = useState(false);
  const [reqs, setReqs] = useState([]);
  const [verdict, setVerdict] = useState(null);
  const [stale, setStale] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [openDraftId, setOpenDraftId] = useState("");
  const [cost, setCost] = useState(null);
  const [piecesSeen, setPiecesSeen] = useState(pieces);

  const refreshCost = useCallback(async () => {
    try {
      setCost(await api.tenderCost(tenderId));
    } catch {
      // le coût est informatif : son absence ne bloque pas le dossier
    }
  }, [tenderId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const loaded = await api.getTender(tenderId);
        const [loadedReqs, loadedDrafts] = await Promise.all([api.listReq(tenderId), api.listDrafts(tenderId)]);
        if (!alive) return;
        setTender(loaded);
        setReqs(loadedReqs);
        setDrafts(loadedDrafts);
        if (loadedDrafts.length) setOpenDraftId(loadedDrafts[0].id);
        if (loadedReqs.length) {
          // le verdict n'est repris que si un rapprochement existe déjà en base
          const previous = await api.readiness(tenderId);
          if (alive && previous.matched > 0) setVerdict(previous);
        }
        refreshCost();
      } catch (e) {
        if (alive && e.status === 404) setMissing(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tenderId, refreshCost]);

  // un document ajouté ou retiré depuis le dernier verdict le rend caduc
  useEffect(() => {
    if (pieces !== piecesSeen) {
      if (verdict) setStale(true);
      setPiecesSeen(pieces);
    }
  }, [pieces, piecesSeen, verdict]);

  const extract = () =>
    run("lecture de l'appel d'offres", async () => {
      await api.extractReq(tenderId);
      const [fresh, list] = await Promise.all([api.getTender(tenderId), api.listReq(tenderId)]);
      setTender(fresh);
      setReqs(list);
      setVerdict(null);
      setStale(false);
      refreshCost();
    });

  const correct = (requirementId, fields) =>
    run("enregistrement de la correction", async () => {
      await api.patchReq(requirementId, fields);
      setReqs(await api.listReq(tenderId));
      if (verdict) setStale(true);
    });

  const check = () =>
    run("vérification du dossier", async () => {
      await api.matchReq(tenderId);
      setVerdict(await api.readiness(tenderId));
      setStale(false);
      refreshCost();
    });

  const generate = (section) =>
    run("rédaction de la méthodologie", async () => {
      const created = await api.draft(tenderId, section);
      setDrafts(await api.listDrafts(tenderId));
      setOpenDraftId(created.id);
      refreshCost();
    });

  if (missing) {
    return (
      <>
        <a className="back" href="#/app">
          ← Mes dossiers
        </a>
        <Empty>Ce dossier n'existe pas, ou il n'appartient pas à votre entreprise.</Empty>
      </>
    );
  }

  if (!tender) {
    return (
      <div className="panel skeleton" aria-busy="true">
        <span />
        <span />
        <span />
      </div>
    );
  }

  const references = pieces.filter((p) => p.kind === "reference" || p.kind === "bilan").length;
  const toTreat = pieces.filter((p) => pieceStatus(p) !== "valide").length;
  const hasReqs = reqs.length > 0;

  const steps = [
    { id: "dao", label: "L'appel d'offres", done: hasReqs },
    { id: "exigences", label: "Exigences", done: hasReqs, locked: !hasReqs },
    { id: "coffre", label: "Vos documents", done: pieces.length > 0 && toTreat === 0, locked: !hasReqs },
    { id: "conformite", label: "Prêt à déposer ?", done: Boolean(verdict?.ready) && !stale, locked: !hasReqs },
    { id: "redaction", label: "Méthodologie", done: drafts.length > 0, locked: !hasReqs },
  ];

  return (
    <>
      <a className="back" href="#/app">
        ← Mes dossiers
      </a>
      <header className="page-head">
        <h1>{tender.title || "Appel d'offres sans titre"}</h1>
        <p>{tender.buyer ? `Acheteur : ${tender.buyer}` : "Lancez la lecture pour relever l'acheteur, la date limite et les exigences."}</p>
      </header>

      <div className="dossier-steps">
        <Stepper steps={steps} />
      </div>

      <Tender tender={tender} requirementsCount={reqs.length} busy={busy} onExtract={extract} step="1" />

      {hasReqs && <Requirements reqs={reqs} busy={busy} stale={stale && Boolean(verdict)} onCorrect={correct} step="2" />}

      {hasReqs && (
        <Section
          id="coffre"
          step="3"
          title="Vos documents"
          lede="Les documents de votre entreprise servent à tous vos dossiers. Ajoutez ou remplacez-les dans « Mes documents »."
          aside={
            <a className="ghost small btn-link" href="#/app/documents">
              Gérer mes documents
            </a>
          }
        >
          <ul className="kpis kpis-inline">
            <li>
              <b>{pieces.length}</b>
              <span>document{pieces.length > 1 ? "s" : ""}</span>
            </li>
            <li className={toTreat ? "kpi-warn" : ""}>
              <b>{toTreat}</b>
              <span>à traiter</span>
            </li>
            <li className={references < 2 ? "kpi-warn" : ""}>
              <b>{references}</b>
              <span>référence{references > 1 ? "s" : ""} de chantier</span>
            </li>
          </ul>
        </Section>
      )}

      {hasReqs && (
        <Readiness verdict={verdict} busy={busy} stale={stale} canCheck={hasReqs} onCheck={check} step="4" />
      )}

      {hasReqs && (
        <Draft
          drafts={drafts}
          openId={openDraftId}
          references={references}
          busy={busy}
          onGenerate={generate}
          onOpen={setOpenDraftId}
          step="5"
        />
      )}

      <Costs cost={cost} />
    </>
  );
}
