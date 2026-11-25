import React from "react";

// Le signe : un M plein, plié en accordéon. Ses deux moitiés ne prennent pas la
// même lumière — la face gauche est éclairée, la droite est dans l'ombre du pli :
// le dossier qu'on plie pour en faire une soumission. La tuile a le coin corné
// d'une feuille. Formes pleines, pas de trait : le signe tient à 16 px.
// Valeurs de référence : docs/09-identite.md.
export const BRAND = "#2b3ae0";
export const BRAND_LIGHT = "#a9b2ff";
export const INK = "#0b1020";
export const CREAM = "#f7f5ef";

// Géométrie partagée avec public/favicon.svg et public/brand/*.svg.
export const TILE = "M7 0H23L32 9V25A7 7 0 0 1 25 32H7A7 7 0 0 1 0 25V7A7 7 0 0 1 7 0Z";
export const CORNER = "M23 0V6A3 3 0 0 0 26 9H32Z";
export const M_LEFT = "M6.5 25V10.5H11.2L16 17V23L11.2 16.6V25Z";
export const M_RIGHT = "M16 17L20.8 10.5H25.5V25H20.8V16.6L16 23Z";

const VARIANTS = {
  // sur fond clair : tuile outremer
  brand: { tile: BRAND, corner: BRAND_LIGHT, left: "#ffffff", right: BRAND_LIGHT },
  // sur fond outremer ou encre : tuile papier
  paper: { tile: CREAM, corner: BRAND_LIGHT, left: INK, right: BRAND },
  // une seule encre (tampons, fax)
  mono: { tile: INK, corner: "#5b6275", left: "#ffffff", right: "#c9ccd6" },
};

export function Mark({ size = 30, variant = "brand", title = "MemoPli" }) {
  const v = VARIANTS[variant] || VARIANTS.brand;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className="mark"
      role="img"
      aria-label={title}
      focusable="false"
    >
      <path d={TILE} fill={v.tile} />
      <path d={CORNER} fill={v.corner} />
      <path d={M_LEFT} fill={v.left} />
      <path d={M_RIGHT} fill={v.right} />
    </svg>
  );
}

export function Wordmark({ className = "" }) {
  return (
    <span className={className ? `wordmark ${className}` : "wordmark"}>
      Memo<span className="wordmark-pli">Pli</span>
    </span>
  );
}

export default function Logo({ size = 30, variant = "brand", withText = true }) {
  return (
    <span className="logo">
      <Mark size={size} variant={variant} />
      {withText && <Wordmark />}
    </span>
  );
}
