// Langue de la page publique : français par défaut, anglais si le navigateur le
// demande. Le choix explicite de l'utilisateur est mémorisé et prime ensuite.
//
// Les textes restent écrits en français dans les composants ; ce module fournit leur
// traduction anglaise. Une chaîne absente du dictionnaire s'affiche en français : on ne
// casse rien, on oublie au pire une ligne.
import { useCallback, useEffect, useReducer } from "react";

const CLE = "memopli.lang";

export const LANGUES = ["fr", "en"];

const ANGLAIS = {
  // ---------------------------------------------------------------- navigation
  "Le parcours": "The journey",
  "Un dossier": "A tender file",
  "Avant de déposer": "Before you submit",
  "Tarif": "Pricing",
  "Questions": "Questions",
  "Garanties": "Guarantees",
  "Se connecter": "Sign in",
  "Commencer": "Get started",
  "Commencer un dossier": "Start a file",
  "Créer un compte": "Create an account",
  "Demander une démonstration": "Request a demo",
  "Nous contacter": "Contact us",
  "J'ai déjà un compte": "I already have an account",
  "Ouvrir le menu": "Open menu",
  "Fermer le menu": "Close menu",
  "Changer de langue": "Change language",
  "Produit": "Product",
  "Contact": "Contact",

  "MemoPli — votre dossier d'appel d'offres": "MemoPli — your tender file",

  // --------------------------------------------------------------------- hero
  "Nouveau": "New",
  "Pour les PME qui répondent aux appels d'offres": "For SMEs bidding on tenders",
  "Ne repartez plus de": "No more starting from",
  "zéro": "scratch",
  "à chaque appel d'offres.": "on every tender.",
  "MemoPli lit le": "MemoPli reads the",
  "dossier d'appel d'offres": "tender file",
  ", relève tout ce que demande l'": ", lists everything the",
  "acheteur": "buyer",
  " avec sa page, vérifie vos documents et rédige la méthodologie de votre":
    " asks for — with its page — checks your documents and drafts the methodology of your",
  "mémoire technique": "technical memo",
  " avec vos chantiers. Vous relisez, vous signez.": " from your own projects. You review, you sign.",
  "À partir de": "From",
  "par dossier · rien à installer": "per file · nothing to install",
  "cinq étapes, un seul parcours": "five steps, one journey",

  // ------------------------------------------------------------ parcours (5)
  "Votre entreprise": "Your company",
  "une fois pour toutes": "entered once, for good",
  "saisie une seule fois.": "entered once.",
  "Saisissez-la une fois : je la reprends dans chacun de vos dossiers.":
    "Enter it once: I reuse it in every tender file.",
  "Vos documents": "Your documents",
  "chaque date surveillée": "every expiry date watched",
  "toujours à jour.": "always up to date.",
  "Sans date de fin de validité, je marque un document « à vérifier » — jamais « valide ».":
    "With no expiry date, I mark a document “to check” — never “valid”.",
  "L'appel d'offres": "The tender",
  "lu page par page": "read page by page",
  "lu page par page.": "read page by page.",
  "Je lis tout le PDF, page par page. C'est ce qui me permet de citer mes sources.":
    "I read the whole PDF, page by page. That is what lets me cite my sources.",
  "Les exigences": "The requirements",
  "chacune avec sa page": "each with its page",
  "chacune avec sa page.": "each with its page.",
  "Une ligne vous semble fausse ? Corrigez-la : votre correction compte plus que ma lecture.":
    "Does a line look wrong? Correct it: your correction counts more than my reading.",
  "Le verdict et le mémoire": "The verdict and the memo",
  "prêt à relire": "ready for review",
  "Le mémoire": "The memo",
  "écrit avec vos chantiers.": "written from your own projects.",
  "Je n'écris qu'avec vos chantiers. Ce qui manque, je le marque « à compléter ».":
    "I only write from your projects. Whatever is missing, I mark “to complete”.",
  "Le parcours · cinq étapes": "The journey · five steps",
  "Choisissez une étape. Chacune s'ouvre quand la précédente est faite.":
    "Pick a step. Each one opens once the previous is done.",
  "Étape {n} sur 5": "Step {n} of 5",

  // frise (6 étapes)
  "Un dossier, de bout en bout": "One file, end to end",
  "Un dossier avec MemoPli.": "One file with MemoPli.",
  "Du PDF de l'acheteur au mémoire à relire. Voici qui fait quoi, étape par étape.":
    "From the buyer's PDF to a memo you review. Here is who does what, step by step.",
  "dépôt → mémoire": "submission → memo",
  "Étape 1": "Step 1",
  "Étape 2": "Step 2",
  "Étape 3": "Step 3",
  "Étape 4": "Step 4",
  "Étape 5": "Step 5",
  "À tout moment": "At any time",
  "Le dossier est lu": "The file is read",
  "Le PDF de l'acheteur est lu en entier, page par page.":
    "The buyer's PDF is read in full, page by page.",
  "pages lues": "pages read",
  "Les exigences sortent": "The requirements come out",
  "Documents demandés et critères de notation, avec leur page.":
    "Required documents and scoring criteria, each with its page.",
  "exigences relevées": "requirements found",
  "Vos documents sont vérifiés": "Your documents are checked",
  "Chaque attestation est comparée à sa date de fin de validité.":
    "Each certificate is checked against its expiry date.",
  "Le verdict tombe": "The verdict lands",
  "Un document expiré ? Le dépôt est bloqué, avant que l'acheteur ne le voie.":
    "An expired document? Submission is blocked before the buyer ever sees it.",
  "La méthodologie s'écrit": "The methodology writes itself",
  "Avec vos chantiers réels. Ce qui manque est marqué « à compléter ».":
    "From your real projects. Whatever is missing is marked “to complete”.",
  "Pli répond": "Pli answers",
  "Une question sur le dossier ? Pli répond et cite la page.":
    "A question about the file? Pli answers and cites the page.",
  "Pas prêt": "Not ready",
  "Prêt": "Ready",
  "à compléter": "to complete",
  "fiscale": "tax",
  "bilan": "accounts",
  "réf.": "refs.",

  // chiffres
  "de FCFA d'achats publics chaque année au Bénin.": "of public procurement every year in Benin.",
  "de ces achats réservés aux PME. L'objectif : 30 à 35 %.":
    "of that spend reserved for SMEs. The target: 30 to 35%.",
  "des contestations rejetées, faute de dossiers solides.":
    "of challenges rejected for lack of a solid file.",
  "ADPME Bénin": "ADPME Benin",
  "ARMP, novembre 2026": "ARMP, November 2026",

  // pour qui
  "Pour qui": "Who it's for",
  "Pour celles et ceux qui montent les dossiers.": "For the people who put the files together.",
  "Responsables administratifs, assistantes de direction, dirigeants de PME : souvent seuls, toujours pressés.":
    "Admin managers, executive assistants, SME owners: often alone, always in a hurry.",
  "Situation {n} sur 3": "Situation {n} of 3",
  "situation {n}": "situation {n}",
  "Quand un appel d'offres paraît": "When a tender is published",
  "Un appel d'offres paraît": "A tender is published",
  "Vous voyez tout de suite ce qu'il demande, et si votre dossier tient la route — avant d'y passer trois jours.":
    "You see at once what it asks for, and whether your file holds up — before losing three days on it.",
  "Quand vous décidez de répondre": "When you decide to bid",
  "Vous décidez de répondre": "You decide to bid",
  "Votre mémoire technique suit déjà les critères de l'acheteur. Vous ne repartez plus d'une page blanche.":
    "Your technical memo already follows the buyer's criteria. No more blank page.",
  "Vous savez qu'aucun document ne manque et qu'aucune date n'est dépassée. Pas d'élimination pour une broutille.":
    "You know no document is missing and no date has passed. No elimination over a detail.",

  // verdict (démo interactive)
  "Le bouton reste gris tant qu'un document manque.":
    "The button stays grey while a document is missing.",
  "Un document expiré compte comme un document manquant. « Prêt à déposer » ne s'active que lorsque tous les documents demandés sont valides. Essayez.":
    "An expired document counts as a missing one. “Ready to submit” only turns on once every required document is valid. Try it.",
  "Tout est en règle. Vous pouvez déposer sereinement.":
    "Everything is in order. You can submit with confidence.",
  "L'attestation CNSS a expiré : je bloque le dépôt tant qu'elle n'est pas remplacée.":
    "The CNSS certificate has expired: I block submission until it is replaced.",

  // garanties
  "Nos garanties": "Our guarantees",
  "Ce que MemoPli ne fera jamais.": "What MemoPli will never do.",
  "Un dossier d'appel d'offres engage votre entreprise. MemoPli ne remplit jamais un vide à votre place.":
    "A tender file commits your company. MemoPli never fills a gap for you.",
  "Essayer": "Try it",
  "garantie": "guarantee",
  "Exigences": "Requirements",
  "Chaque exigence avec sa page": "Every requirement with its page",
  "Vous vérifiez d'un coup d'œil dans le document d'origine. Rien n'est affirmé sans preuve.":
    "You check the original document at a glance. Nothing is claimed without proof.",
  "Rédaction": "Drafting",
  "Rien d'inventé": "Nothing invented",
  "Si le dossier ne dit rien, MemoPli l'indique. S'il manque une information, il écrit « à compléter ».":
    "If the file says nothing, MemoPli says so. When information is missing, it writes “to complete”.",
  "Confidentialité": "Confidentiality",
  "Vos documents restent les vôtres": "Your documents stay yours",
  "Vos attestations, bilans et références ne sont jamais transmis à un service extérieur.":
    "Your certificates, accounts and references are never sent to an outside service.",
  "Dépôt": "Submission",
  "Un document expiré bloque le dépôt": "An expired document blocks submission",
  "Il compte comme un document manquant. Vous le savez avant l'acheteur, pas après.":
    "It counts as a missing document. You know before the buyer does, not after.",

  // lexique
  "Même chose, autres noms": "Same thing, other names",
  "Chacun ses mots. Le dossier reste le même.": "Different words, same file.",
  "D'un pays ou d'un organisme à l'autre, les mêmes documents changent de nom. Voici les équivalences les plus courantes.":
    "From one country or body to the next, the same documents change name. Here are the most common equivalents.",
  "Nommez vos documents avec vos propres mots : vous vérifiez chaque rapprochement que je propose.":
    "Name your documents in your own words: you check every match I propose.",
  "Dossier d'appel d'offres": "Tender file",
  "DAO": "RFQ",
  "DCE": "tender pack",
  "cahier des charges": "specifications",
  "dossier de consultation": "consultation file",
  "termes de référence (TDR)": "terms of reference (ToR)",
  "Acheteur": "Buyer",
  "autorité contractante": "contracting authority",
  "maître d'ouvrage": "client",
  "bailleur": "donor",
  "donneur d'ordre": "principal",
  "Mémoire technique": "Technical memo",
  "offre technique": "technical offer",
  "proposition technique": "technical proposal",
  "note méthodologique": "methodology note",
  "Critères de notation": "Scoring criteria",
  "grille d'évaluation": "evaluation grid",
  "critères d'attribution": "award criteria",
  "barème": "marking scale",
  "Documents administratifs": "Administrative documents",
  "pièces administratives": "administrative documents",
  "justificatifs": "supporting documents",
  "attestations": "certificates",
  "Attestation fiscale": "Tax clearance certificate",
  "quitus fiscal": "tax clearance",
  "attestation de régularité fiscale": "certificate of tax compliance",
  "certificat de non-redevance": "no-debt certificate",
  "Registre du commerce": "Trade register",
  "RCCM": "RCCM",
  "extrait Kbis": "company registration extract",
  "immatriculation": "registration",

  // questions
  "Avant votre prochain dépôt.": "Before your next submission.",
  "Encore un doute ?": "Still unsure?",
  "Écrivez-nous": "Write to us",
  ", ou posez-moi la question dans votre dossier.": ", or ask me in your file.",
  "Mes documents sont-ils en sécurité ?": "Are my documents safe?",
  "Vos documents restent dans votre espace MemoPli. Pour savoir quel document répond à quelle demande, seuls son nom, son type et sa date sont utilisés — jamais le document lui-même.":
    "Your documents stay in your MemoPli workspace. To know which document answers which request, only its name, type and date are used — never the document itself.",
  "Et si MemoPli lit mal une exigence ?": "What if MemoPli misreads a requirement?",
  "Chaque exigence indique la page du dossier d'où elle vient : vous vérifiez et vous corrigez. C'est votre correction qui compte. Si le dossier ne précise rien, MemoPli écrit « non extrait » au lieu de deviner.":
    "Every requirement shows the page it comes from: you check and correct it. Your correction is what counts. If the file is silent, MemoPli writes “not extracted” instead of guessing.",
  "Le texte rédigé est-il prêt à signer ?": "Is the drafted text ready to sign?",
  "C'est une base de travail, à relire et à adapter. Elle s'appuie uniquement sur vos références ; il faut au moins deux références de chantiers dans vos documents.":
    "It is a working base, to review and adapt. It relies only on your references; you need at least two project references in your documents.",
  "Mon dossier d'appel d'offres est scanné.": "My tender file is a scan.",
  "MemoPli lit les PDF dont on peut sélectionner le texte. Si le fichier n'est qu'une image, l'écran vous le dit plutôt que de vous donner une liste incomplète.":
    "MemoPli reads PDFs whose text can be selected. If the file is only an image, the screen tells you rather than giving you an incomplete list.",
  "Faut-il installer quelque chose ?": "Do I need to install anything?",
  "Non. MemoPli s'utilise dans le navigateur, sur ordinateur comme sur tablette.":
    "No. MemoPli runs in the browser, on a computer or a tablet.",

  // tarif
  "Vous payez un dossier. Pas un logiciel.": "You pay for a file. Not for software.",
  "Pas d'abonnement obligatoire, rien à installer : le prix suit le dossier que vous préparez.":
    "No mandatory subscription, nothing to install: the price follows the file you prepare.",
  "Par dossier": "Per file",
  "Selon la taille du mémoire.": "Depending on the size of the memo.",
  "Tout ce que demande l'acheteur, page par page": "Everything the buyer asks for, page by page",
  "Le contrôle de vos documents et le verdict": "Your documents checked, and the verdict",
  "La méthodologie rédigée avec vos chantiers": "The methodology drafted from your projects",
  "Pli pour répondre à vos questions": "Pli to answer your questions",
  "Un accompagnement sur votre premier dossier": "Hands-on help on your first file",
  "Abonnement": "Subscription",
  "3 dossiers / mois": "3 files / month",
  "Pour les entreprises qui répondent chaque semaine. Tarif sur demande.":
    "For companies bidding every week. Price on request.",
  "Tout ce que comprend l'offre par dossier": "Everything in the per-file plan",
  "Vos documents suivis en continu": "Your documents tracked continuously",
  "À titre de comparaison, un cabinet qui monte le dossier pour vous facture 300 000 à 500 000 FCFA.":
    "For comparison, a consultancy that prepares the file for you charges 300,000 to 500,000 FCFA.",

  // accompagnement
  "Accompagnement": "Support",
  "On vous accompagne sur le premier dossier.": "We walk you through your first file.",
  "Le premier dépôt est celui qui compte. Nous le préparons avec vous, puis vous êtes autonome — avec Pli pour répondre à vos questions.":
    "The first submission is the one that matters. We prepare it with you, then you are independent — with Pli to answer your questions.",
  "Une assistance sur WhatsApp": "Support on WhatsApp",
  "Demander à Pli": "Ask Pli",
  "lit le dossier": "reads the file",
  "Quelle garantie de soumission est demandée ?": "What bid guarantee is required?",
  "2 % du montant estimé": "2% of the estimated amount",
  ", soit 25 000 000 FCFA": ", i.e. 25,000,000 FCFA",
  ". Dépôt avant le 18 décembre 2026 à 10 h": ". Submission before 18 December 2026 at 10:00",
  "Exemple · aucun de vos documents n'est envoyé": "Example · none of your documents is sent",

  // appel à l'action final et pied de page
  "Le dossier est complet.": "The file is complete.",
  "Le dépôt est serein.": "Submission is calm.",
  "Le poste de travail des appels d'offres pour les PME du Bénin.":
    "The tender workspace for Benin's SMEs.",
  "Cotonou, Bénin": "Cotonou, Benin",
  "Assistance sur WhatsApp": "Support on WhatsApp",
  "© {annee} MemoPli. Chiffres : ADPME Bénin ; ARMP, novembre 2026.":
    "© {annee} MemoPli. Figures: ADPME Benin; ARMP, November 2026.",
  "Mise en page inspirée de « mesa » par LN (MIT) · composants animés":
    "Layout inspired by “mesa” by LN (MIT) · animated components",

  // maquette du hero et démos d'écran
  "Exemple : les exigences d'un appel d'offres, chacune avec sa page et son statut":
    "Example: the requirements of a tender, each with its page and status",
  "Voirie urbaine · Akpakpa": "Urban roadworks · Akpakpa",
  "Exemple de dossier · Mairie de Cotonou": "Sample file · Cotonou City Council",
  "exigences": "requirements",
  "blocages": "blockers",
  "exemple": "sample",
  "Attestation CNSS": "Social security certificate",
  "Garantie de soumission · 2 %": "Bid guarantee · 2%",
  "Trois références": "Three references",
  "Bilans 2024–2025": "Accounts 2024–2025",
  "Méthodologie · 40 %": "Methodology · 40%",
  "Prix · 35 %": "Price · 35%",
  "Moyens humains · 15 %": "Staffing · 15%",
  "Délai d'exécution": "Completion period",
  "valide": "valid",
  "expiré": "expired",
  "expirée": "expired",
  "manquant": "missing",
  "critère": "criterion",
  "non extrait": "not extracted",
  "à vérifier": "to check",
  "Nom de l'entreprise": "Company name",
  "Numéro fiscal (IFU)": "Tax number (IFU)",
  "Secteur": "Sector",
  "Bâtiment, travaux publics": "Building, public works",
  "Attestation fiscale 2026": "Tax clearance certificate 2026",
  "valable jusqu'au 31 mars 2027": "valid until 31 March 2027",
  "expirée depuis le 30 septembre": "expired since 30 September",
  "Extrait RCCM": "RCCM extract",
  "aucune date de fin": "no expiry date",
  "Bilan 2025": "Accounts 2025",
  "valable jusqu'au 30 juin 2027": "valid until 30 June 2027",
  "84 pages · lecture en cours": "84 pages · reading",
  "Attestation fiscale de moins de trois mois": "Tax clearance certificate under three months old",
  "Garantie de soumission de 2 %": "Bid guarantee of 2%",
  "Note méthodologique": "Methodology note",
  "Prêt à déposer": "Ready to submit",
  "aucun document manquant ni expiré": "no missing or expired document",
  "Méthodologie et organisation": "Methodology and organisation",
  "à relire avant signature": "to review before signing",

  // verdict interactif
  "Attestation de régularité fiscale": "Tax compliance certificate",
  "Registre du commerce (RCCM)": "Trade register (RCCM)",
  "Aucun blocage. Le bouton se libère.": "No blocker. The button unlocks.",
  "1 blocage : Attestation CNSS expirée.": "1 blocker: expired CNSS certificate.",
  "Revenir au document expiré": "Back to the expired document",
  "Remplacer l'attestation CNSS": "Replace the CNSS certificate",

  // lexique affiché dans les info-bulles
  "Dossier d'appel d'offres (DAO)": "Tender dossier (DAO)",
  "Le dossier publié par l'acheteur : ce qu'il veut acheter, les documents à fournir, la façon dont les offres seront notées et la date limite.":
    "The file the buyer publishes: what it wants to buy, the documents to supply, how bids will be scored, and the deadline.",
  "La grille qui dit comment l'acheteur note les offres, avec le poids de chaque critère — par exemple : méthodologie, 30 % de la note.":
    "The grid that says how the buyer scores bids, with the weight of each criterion — for example: methodology, 30% of the score.",
  "Le numéro fiscal de l'entreprise au Bénin. Ailleurs : NIF, NINEA, numéro de contribuable.":
    "The company's tax number in Benin. Elsewhere: NIF, NINEA, taxpayer number.",
  "L'immatriculation de l'entreprise au registre du commerce. En France : l'extrait Kbis.":
    "The company's registration in the trade register. In France: the Kbis extract.",
  "L'organisme qui lance l'appel d'offres et choisit l'entreprise : ministère, mairie, établissement public, projet financé par un bailleur de fonds, ONG…":
    "The organisation that launches the tender and picks the company: ministry, city council, public body, donor-funded project, NGO…",
  "La partie de votre offre où vous expliquez comment vous ferez le travail : méthode, équipe, matériel, planning. On dit aussi offre technique ou note méthodologique.":
    "The part of your bid where you explain how you will do the work: method, team, equipment, schedule. Also called technical offer or methodology note.",
};

/** Langue au premier chargement : choix mémorisé, sinon celle du navigateur.
 *
 * Seule la langue *principale* compte : un navigateur en français qui liste l'anglais
 * en secours reste en français.
 */
export function langueInitiale() {
  try {
    const choix = localStorage.getItem(CLE);
    if (LANGUES.includes(choix)) return choix;
  } catch {
    /* stockage indisponible (navigation privée stricte) : on détecte */
  }
  const preferees = navigator.languages?.length ? navigator.languages : [navigator.language || "fr"];
  return String(preferees[0] || "fr").toLowerCase().startsWith("en") ? "en" : "fr";
}

let langueCourante = langueInitiale();
const abonnes = new Set();

if (typeof document !== "undefined") document.documentElement.lang = langueCourante;

/** Fixe la langue, la mémorise et prévient les composants affichés. */
export function appliquerLangue(langue) {
  if (!LANGUES.includes(langue) || langue === langueCourante) return;
  langueCourante = langue;
  try {
    localStorage.setItem(CLE, langue);
  } catch {
    /* rien à mémoriser */
  }
  document.documentElement.lang = langue;
  abonnes.forEach((prevenir) => prevenir());
}

/** Traduit un texte français ; `valeurs` remplit les `{n}` du gabarit. */
export function traduire(texte, langue, valeurs) {
  const traduit = langue === "en" ? (ANGLAIS[texte] ?? texte) : texte;
  if (!valeurs) return traduit;
  return traduit.replace(/\{(\w+)\}/g, (_, cle) => String(valeurs[cle] ?? `{${cle}}`));
}

export function useLangue() {
  const [, rafraichir] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    abonnes.add(rafraichir);
    return () => abonnes.delete(rafraichir);
  }, []);
  return { langue: langueCourante, changer: appliquerLangue };
}

/** `t("texte français")` → texte affiché dans la langue courante. */
export function useT() {
  const { langue } = useLangue();
  return useCallback((texte, valeurs) => traduire(texte, langue, valeurs), [langue]);
}
