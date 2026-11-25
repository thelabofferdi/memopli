// Formatage et règles de lecture. Les statuts officiels sont calculés par le
// serveur (app/main.py:compute_status) ; ce module ne fait que reproduire la
// même règle à l'identique pour les pièces du coffre, jamais pour deviner un
// rapprochement.

export const PIECE_KINDS = {
  attestation_fiscale: "Attestation fiscale",
  cnss: "Attestation CNSS",
  rccm: "Registre du commerce",
  reference: "Référence de chantier",
  bilan: "Bilan",
  autre: "Autre",
};

// Libellés d'écran (langage simple). Les codes restent ceux du serveur.
export const STATUS = {
  valide: "valide",
  perime: "expiré",
  manquant: "manquant",
  a_verifier: "à vérifier",
};

export const isoToday = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

/** Miroir exact de compute_status() côté serveur. */
export function pieceStatus(piece, today = isoToday()) {
  if (!piece) return "manquant";
  if (!piece.expires_on) return "a_verifier";
  return piece.expires_on < today ? "perime" : "valide";
}

export function daysLeft(iso, today = isoToday()) {
  if (!iso) return null;
  const diff = Date.parse(`${iso}T00:00:00`) - Date.parse(`${today}T00:00:00`);
  if (Number.isNaN(diff)) return null;
  return Math.round(diff / 86400000);
}

export function deadlineLabel(iso, today = isoToday()) {
  const days = daysLeft(iso, today);
  if (days === null) return null;
  if (days < 0) return `dépassée depuis ${-days} j`;
  if (days === 0) return "aujourd'hui";
  return `dans ${days} j`;
}

/** 2026-03-12 → 12 mars 2026. Une valeur illisible est rendue telle quelle. */
export function dateFr(iso) {
  if (!iso) return null;
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}

export const kindLabel = (kind) => PIECE_KINDS[kind] || kind || "non extrait";

const SECTION_LABELS = {
  methodologie: "Méthodologie",
  organisation: "Organisation",
};

export const sectionLabel = (section) =>
  SECTION_LABELS[section] || section.charAt(0).toUpperCase() + section.slice(1);

export const statusLabel = (status) => STATUS[status] || status || "non vérifié";

export const number = (n) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n);

export function costLabel(cost) {
  if (cost === null || cost === undefined) return null;
  return `${number(cost)} FCFA`;
}

export function metaLabel(meta) {
  if (!meta) return null;
  const parts = [meta.model];
  if (meta.seconds !== undefined && meta.seconds !== null) parts.push(`${meta.seconds} s`);
  if (meta.tokens_in || meta.tokens_out) parts.push(`${meta.tokens_in || 0} + ${meta.tokens_out || 0} jetons`);
  if (meta.cost_fcfa !== undefined && meta.cost_fcfa !== null) parts.push(costLabel(meta.cost_fcfa));
  return parts.filter(Boolean).join(" · ");
}

/** Une valeur extraite sans page ne s'affiche pas comme un fait : elle est signalée. */
export const pageLabel = (page) =>
  page === null || page === undefined || page === "" ? "page non extraite" : `p. ${page}`;

export function errorText(error) {
  if (!error) return "";
  if (typeof error === "string") return error;
  return error.message || error.code || "erreur inconnue";
}
