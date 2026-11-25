import React, { useCallback, useEffect, useState } from "react";
import * as api from "../lib/api.js";
import Company from "../components/Company.jsx";
import { Mark, Wordmark } from "../components/brand/Logo.jsx";
import { Icon, PageHead, Ring } from "../components/brand/Brand.jsx";
import DocChecklist from "../components/DocChecklist.jsx";
import Mascot from "../components/brand/Mascot.jsx";
import Alerts from "../components/Alerts.jsx";
import { Toaster, toast } from "../components/ui/toast.tsx";
import { Badge } from "../components/Ui.jsx";
import Vault from "../components/Vault.jsx";
import { nextDeadline, pieceStatus } from "../lib/format.js";
import { navigate } from "../lib/router.js";
import Account from "./Account.jsx";
import Dossier from "./Dossier.jsx";
import Dossiers from "./Dossiers.jsx";
import Home from "./Home.jsx";
import Search from "./Search.jsx";

// Espace client : barre latérale (dossiers, documents, entreprise, compte) et
// une page par entrée. Les données partagées (compte, entreprise, documents)
// vivent ici ; chaque dossier charge les siennes.

const NAV = [
  { to: "/app", match: (p) => p === "/app" || p === "/app/", label: "Accueil", icon: "home" },
  { to: "/app/dossiers", match: (p) => p.startsWith("/app/dossiers"), label: "Mes dossiers", icon: "folder" },
  { to: "/app/recherche", match: (p) => p.startsWith("/app/recherche"), label: "Rechercher", icon: "search" },
  { to: "/app/documents", match: (p) => p.startsWith("/app/documents"), label: "Mes documents", icon: "files" },
  { to: "/app/entreprise", match: (p) => p.startsWith("/app/entreprise"), label: "Mon entreprise", icon: "building" },
];


// la recherche a besoin des titres des dossiers pour ses liens et son filtre
function SearchPage({ org }) {
  const [tenders, setTenders] = useState([]);
  useEffect(() => {
    api.listTenders(org.id).then(setTenders).catch(() => setTenders([]));
  }, [org.id]);
  return <Search org={org} tenders={tenders} />;
}

const profileScore = (org) =>
  [org?.ifu, org?.rccm, org?.sector, org?.headcount].filter((v) => v !== null && v !== undefined && v !== "").length / 4;

// messages de réussite, par action (mêmes libellés que run())
const DONE = {
  "ajout du document": "Document ajouté.",
  "retrait du document": "Document retiré.",
  "remplacement du document": "Document remplacé.",
  "enregistrement de l'entreprise": "Entreprise enregistrée.",
  "dépôt du dossier": "Dossier déposé.",
  "lecture de l'appel d'offres": "Exigences relevées.",
  "enregistrement de la correction": "Correction enregistrée.",
  "vérification du dossier": "Vérification terminée.",
  "rédaction de la méthodologie": "Méthodologie rédigée.",
};

export default function Workspace({ path }) {
  const [user, setUser] = useState(null);
  const [org, setOrg] = useState(null);
  const [pieces, setPieces] = useState([]);
  const [tenders, setTenders] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState(null);
  const [menu, setMenu] = useState(false);

  const route = path.split("?")[0];
  const query = new URLSearchParams(path.split("?")[1] || "");
  // date limite la plus proche : « Mes documents » explique la règle du dossier avec elle
  const deadlineProche = nextDeadline(tenders);

  // ------------------------------------------------------------ amorçage

  useEffect(() => {
    let alive = true;
    api
      .health()
      .then((h) => alive && setHealth(h))
      .catch(() => alive && setHealth({ ok: false }));

    (async () => {
      try {
        const profile = await api.me();
        if (!alive) return;
        setUser(profile.user);
        const first = profile.orgs?.[0];
        if (first) {
          const [full, list] = await Promise.all([api.getOrg(first.id), api.listPieces(first.id)]);
          if (!alive) return;
          setOrg(full);
          setPieces(list);
          api.listTenders(first.id).then((t) => alive && setTenders(t)).catch(() => alive && setTenders([]));
        }
      } catch (e) {
        if (alive) setError(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    const onExpired = () => navigate("/connexion?expiree=1", { replace: true });
    window.addEventListener(api.SESSION_EXPIRED, onExpired);
    return () => {
      alive = false;
      window.removeEventListener(api.SESSION_EXPIRED, onExpired);
    };
  }, []);

  useEffect(() => setMenu(false), [route]);

  // ---------------------------------------------------------- utilitaires

  // Chaque action affiche un toast (Rare UI) : en cours → réussi ou échec.
  const run = useCallback(async (label, fn) => {
    setBusy(label);
    setError(null);
    const id = toast.loading(`${label.charAt(0).toUpperCase()}${label.slice(1)}…`);
    try {
      await fn();
      toast.success(DONE[label] || "C'est fait.", { id, duration: 3000 });
      return true;
    } catch (e) {
      const err = e instanceof api.ApiError ? e : { code: "erreur", message: String(e) };
      toast.error(err.message || "Une erreur est survenue.", { id, duration: 6000 });
      setError(err);
      return false;
    } finally {
      setBusy("");
    }
  }, []);

  const reloadTenders = useCallback(async () => {
    if (org) setTenders(await api.listTenders(org.id).catch(() => []));
  }, [org]);

  // revenir sur l'accueil ou la liste rafraîchit l'avancement des dossiers
  useEffect(() => {
    if (route === "/app" || route === "/app/dossiers") reloadTenders();
  }, [route, reloadTenders]);

  const reloadPieces = useCallback(async () => {
    if (org) setPieces(await api.listPieces(org.id));
  }, [org]);

  // ------------------------------------------------------------ actions

  const saveCompany = (fields) =>
    run("enregistrement de l'entreprise", async () => {
      if (org) setOrg(await api.updateOrg(org.id, fields));
      else {
        const created = await api.createOrg(fields);
        setOrg(await api.getOrg(created.id));
        setPieces([]);
        setTenders([]);
      }
    });

  const addPiece = (fields) =>
    run("ajout du document", async () => {
      await api.addPiece({ org_id: org.id, ...fields });
      await reloadPieces();
    });

  const removePiece = (piece) =>
    run("retrait du document", async () => {
      await api.delPiece(piece.id);
      await reloadPieces();
    });

  const replacePiece = (piece, replacement) =>
    run("remplacement du document", async () => {
      await api.delPiece(piece.id);
      await api.addPiece({
        org_id: org.id,
        kind: piece.kind,
        label: piece.label,
        expires_on: replacement.expires_on,
        file: replacement.file,
      });
      await reloadPieces();
    });

  const signOut = async () => {
    try {
      await api.logout();
    } catch {
      // jeton déjà expiré : on se déconnecte quand même côté navigateur
    }
    api.session.set(null);
    navigate("/connexion", { replace: true });
  };

  // -------------------------------------------------------------- rendu

  const toTreat = pieces.filter((p) => pieceStatus(p) !== "valide").length;
  const apiDown = health && health.ok === false;
  const noKey = health && health.ok && health.ai_key === false;

  let page;
  if (loading) {
    page = (
      <div className="panel skeleton" aria-busy="true">
        <span />
        <span />
        <span />
      </div>
    );
  } else if (!org) {
    page = (
      <>
        <PageHead
          kicker="Bienvenue"
          title="Commençons par votre entreprise."
          sub="Elle sera reprise dans chacun de vos dossiers."
          tip="Bonjour, je suis Pli. Je vous accompagne de l'entreprise jusqu'au mémoire."
        />
        <Company org={null} busy={busy} onSave={saveCompany} />
      </>
    );
  } else if (route.startsWith("/app/dossiers/")) {
    page = (
      <Dossier
        key={route}
        tenderId={decodeURIComponent(route.slice("/app/dossiers/".length))}
        orgId={org.id}
        pieces={pieces}
        busy={busy}
        run={run}
      />
    );
  } else if (route.startsWith("/app/documents")) {
    page = (
      <>
        <PageHead
          kicker="Mes documents"
          title="Vos pièces, toujours à jour."
          sub="Attestations, registres, références et bilans : ils servent à tous vos dossiers."
          tip="Indiquez la date de fin de chaque document : je vous préviens avant qu'il n'expire."
          mood="think"
        />
        <Vault
          pieces={pieces}
          busy={busy}
          onAdd={addPiece}
          onRemove={removePiece}
          onReplace={replacePiece}
          deadline={deadlineProche}
          side={<DocChecklist pieces={pieces} />}
        />
      </>
    );
  } else if (route.startsWith("/app/entreprise")) {
    page = (
      <>
        <PageHead
          kicker="Mon entreprise"
          title={org.name}
          sub="Ces informations sont reprises dans chacun de vos dossiers."
          tip={
            query.get("bienvenue")
              ? "Votre compte est créé ! Complétez votre entreprise, puis ajoutez vos documents."
              : "Numéro fiscal et registre du commerce sont demandés dans presque tous les appels d'offres."
          }
          actions={<Ring value={profileScore(org)} size={64} stroke={7} label={`${Math.round(profileScore(org) * 4)}/4`} />}
        />
        {query.get("bienvenue") && (
          <div className="welcome">
            <strong>Étape suivante :</strong> ajoutez vos attestations et deux références de chantiers.
            <div className="welcome-actions">
              <button type="button" onClick={() => navigate("/app/documents")}>
                Ajouter mes documents
              </button>
            </div>
          </div>
        )}
        <Company org={org} busy={busy} onSave={saveCompany} startEditing={Boolean(query.get("bienvenue"))} />
      </>
    );
  } else if (route.startsWith("/app/recherche")) {
    page = <SearchPage org={org} />;
  } else if (route.startsWith("/app/compte")) {
    page = <Account user={user} org={org} onSignOut={signOut} />;
  } else if (route.startsWith("/app/dossiers")) {
    page = (
      <Dossiers
        org={org}
        pieces={pieces}
        tenders={tenders}
        busy={busy}
        run={run}
        openNew={query.get("nouveau") === "1"}
      />
    );
  } else {
    page = <Home org={org} pieces={pieces} tenders={tenders} user={user} />;
  }

  const lastTender = tenders && tenders[0];

  return (
    <div className={menu ? "ws menu-open" : "ws"}>
      <aside className="side" aria-label="Navigation principale">
        <div className="side-top">
          <a className="side-brand" href="#/app">
            <Mark size={30} />
            <Wordmark />
          </a>
          {org && <Alerts pieces={pieces} tenders={tenders} size={36} />}
        </div>

        {org && (
          <div className="side-org" title={org.name}>
            <span className="org-av" aria-hidden="true">
              {org.name.trim().charAt(0).toUpperCase()}
            </span>
            <span className="side-org-text">
              <strong>{org.name}</strong>
              <small>{org.sector || "Entreprise"}</small>
            </span>
          </div>
        )}

        <nav className="side-nav">
          {NAV.map((item) => (
            <a
              key={item.to}
              href={`#${item.to}`}
              className={item.match(route) ? "side-link on" : "side-link"}
              aria-current={item.match(route) ? "page" : undefined}
            >
              <Icon name={item.icon} size={20} />
              <span>{item.label}</span>
              {item.icon === "files" && toTreat > 0 && <span className="side-count">{toTreat}</span>}
            </a>
          ))}
        </nav>

        <div className="side-foot">
          <div className="side-pli">
            <span className="side-pli-av" aria-hidden="true">
              <Mascot size={40} animated={false} />
            </span>
            <p>
              <strong>Une question ?</strong>
              Pli lit vos dossiers et cite la page.
            </p>
            <a href={lastTender ? `#/app/dossiers/${lastTender.id}?pli=1` : "#/app/dossiers?nouveau=1"}>
              {lastTender ? "Demander à Pli" : "Déposer un dossier"} <Icon name="arrow" size={14} />
            </a>
          </div>
          {(apiDown || noKey) && (
            <div className="side-status">
              {apiDown && <Badge status="perime">service indisponible</Badge>}
              {noKey && (
                <Badge status="a_verifier">
                  <span title="Clé RODIUM_API_KEY absente : lecture, vérification et rédaction échoueront.">
                    analyse indisponible
                  </span>
                </Badge>
              )}
            </div>
          )}
          <a
            href="#/app/compte"
            className={route.startsWith("/app/compte") ? "side-user on" : "side-user"}
            aria-current={route.startsWith("/app/compte") ? "page" : undefined}
          >
            <span className="side-user-av" aria-hidden="true">
              <Icon name="user" size={20} />
            </span>
            <span className="side-user-text">
              <strong>Mon compte</strong>
              <small>{user?.email || "…"}</small>
            </span>
          </a>
        </div>
      </aside>

      <div className="ws-main">
        <header className="ws-bar">
          <button
            type="button"
            className="ws-burger"
            aria-label={menu ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={menu}
            onClick={() => setMenu((m) => !m)}
          >
            <Icon name="menu" size={20} />
          </button>
          <a className="side-brand" href="#/app">
            <Mark size={28} />
            <Wordmark />
          </a>
          {org && <Alerts pieces={pieces} tenders={tenders} size={40} align="right" />}
        </header>
        <button type="button" className="ws-scrim" aria-label="Fermer le menu" tabIndex={-1} onClick={() => setMenu(false)} />

        <main className="ws-content">
          {page}
        </main>
      </div>

      <span className="rui">
        <Toaster position="bottom-center" />
      </span>
    </div>
  );
}
