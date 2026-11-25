import React from "react";
import { LANGUES, useLangue, useT } from "./i18n.js";

const SIGLES = { fr: "FR", en: "EN" };
const NOMS = { fr: "Français", en: "English" };

/** Sélecteur de langue de la page publique. Le choix est mémorisé. */
export default function LangSwitch({ className = "" }) {
  const { langue, changer } = useLangue();
  const t = useT();
  return (
    <div className={className ? `v2-lang ${className}` : "v2-lang"} role="group" aria-label={t("Changer de langue")}>
      {LANGUES.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          title={NOMS[code]}
          aria-pressed={code === langue}
          className={code === langue ? "on" : ""}
          onClick={() => changer(code)}
        >
          {SIGLES[code]}
        </button>
      ))}
    </div>
  );
}
