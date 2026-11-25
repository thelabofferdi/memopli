import React from "react";

// « Pli », la mascotte : une feuille de dossier au coin plié, qui salue d'une
// main et brandit le visa de conformité de l'autre. L'étiquette « p. 12 »
// rappelle la règle du produit : chaque valeur porte sa page.
// Charte (docs/09-identite.md) : le visa est en bleu marque, pas en vert —
// la mascotte est la marque, pas un statut.
// Vecteur pur, contours encre, aplats de la palette — aucune image externe.
const INK = "#0b1020";

function Spark({ x, y, s = 1, fill = "#a9b2ff" }) {
  return (
    <path
      className="pli-spark"
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 -11Q2 -2 11 0Q2 2 0 11Q-2 2 -11 0Q-2 -2 0 -11Z"
      fill={fill}
      stroke={INK}
      strokeWidth="2.6"
      strokeLinejoin="round"
    />
  );
}

// Humeurs : « happy » (par défaut), « worried » (un document bloque le dépôt),
// « think » (Pli lit le dossier). Le visa reste bleu dans tous les cas : la
// mascotte est la marque, jamais un statut.
const MOUTHS = {
  happy: "M148 158Q163 174 178 158",
  worried: "M148 166Q163 154 178 166",
  think: "M152 163H174",
};

export default function Mascot({ size = 320, title = "Pli, la mascotte de MemoPli", animated = true, mood = "happy" }) {
  return (
    <svg
      className={[animated ? "pli pli-animated" : "pli", `pli-${mood}`].join(" ")}
      width={size}
      height={size * (340 / 320)}
      viewBox="0 0 320 340"
      role="img"
      aria-label={title}
    >
      <ellipse cx="162" cy="318" rx="84" ry="10" fill={INK} opacity="0.1" className="pli-shadow" />

      <Spark x={56} y={78} />
      <Spark x={276} y={248} s={0.75} fill="#f7f5ef" />
      <Spark x={36} y={262} s={0.6} />

      <g className="pli-bob">
        {/* jambes */}
        <path d="M134 278v22M190 278v22" stroke={INK} strokeWidth="7" strokeLinecap="round" />
        <ellipse cx="128" cy="304" rx="15" ry="7.5" fill={INK} />
        <ellipse cx="196" cy="304" rx="15" ry="7.5" fill={INK} />

        {/* bras gauche qui salue */}
        <g className="pli-wave">
          <path d="M92 186Q60 176 50 142" stroke={INK} strokeWidth="7" strokeLinecap="round" fill="none" />
          <circle cx="48" cy="134" r="10" fill="#fff" stroke={INK} strokeWidth="4.5" />
          <path d="M28 120q-6 8-4 18M22 108q-12 14-8 34" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.35" />
        </g>

        {/* corps : la feuille */}
        <path
          d="M90 70Q90 56 104 56H196L238 98V266Q238 282 222 282H104Q90 282 90 266Z"
          fill="#fff"
          stroke={INK}
          strokeWidth="5.5"
          strokeLinejoin="round"
        />
        {/* le pli */}
        <path
          d="M196 56V86Q196 98 208 98H238Z"
          fill="#a9b2ff"
          stroke={INK}
          strokeWidth="5.5"
          strokeLinejoin="round"
        />

        {/* visage */}
        <g className="pli-eyes">
          <ellipse cx="136" cy={mood === "think" ? 134 : 138} rx="9.5" ry="12.5" fill={INK} />
          <ellipse cx="190" cy={mood === "think" ? 134 : 138} rx="9.5" ry="12.5" fill={INK} />
          <circle cx={mood === "think" ? 141 : 139.5} cy={mood === "think" ? 127 : 132.5} r="3.4" fill="#fff" />
          <circle cx={mood === "think" ? 195 : 193.5} cy={mood === "think" ? 127 : 132.5} r="3.4" fill="#fff" />
        </g>
        {mood === "worried" && (
          <path d="M122 120l22 -7M204 120l-22 -7" stroke={INK} strokeWidth="4.5" strokeLinecap="round" />
        )}
        <ellipse cx="118" cy="161" rx="11" ry="6.5" fill="#f6b3a0" opacity="0.55" />
        <ellipse cx="208" cy="161" rx="11" ry="6.5" fill="#f6b3a0" opacity="0.55" />
        <path className="pli-mouth" d={MOUTHS[mood] || MOUTHS.happy} stroke={INK} strokeWidth="5" strokeLinecap="round" fill="none" />

        {/* lignes de texte et étiquette de page */}
        <path d="M114 198H214M114 216H196" stroke="#cbd5e1" strokeWidth="6.5" strokeLinecap="round" />
        <rect x="114" y="234" width="56" height="24" rx="12" fill="#eceeff" stroke="#2b3ae0" strokeWidth="2.5" />
        <text
          x="142"
          y="250.5"
          textAnchor="middle"
          fontSize="13"
          fontWeight="700"
          fill="#2b3ae0"
          fontFamily="Geist, ui-sans-serif, system-ui, sans-serif"
        >
          p. 12
        </text>

        {/* bras droit qui brandit le visa */}
        <path d="M236 196Q266 198 272 168" stroke={INK} strokeWidth="7" strokeLinecap="round" fill="none" />
        <g className="pli-badge">
          <circle cx="280" cy="136" r="27" fill="#2b3ae0" stroke={INK} strokeWidth="5" />
          {mood === "worried" ? (
            <path d="M280 122v16M280 149v.5" stroke="#fff" strokeWidth="6.5" strokeLinecap="round" fill="none" />
          ) : mood === "think" ? (
            <path d="M268 136h.5M280 136h.5M292 136h.5" stroke="#fff" strokeWidth="7" strokeLinecap="round" fill="none" />
          ) : (
            <path d="M267 137l9 9 17-18" stroke="#fff" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          )}
        </g>
        <circle cx="272" cy="166" r="10" fill="#fff" stroke={INK} strokeWidth="4.5" />
      </g>
    </svg>
  );
}
