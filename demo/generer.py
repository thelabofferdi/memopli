"""Génère les PDF fictifs de la démonstration (texte sélectionnable).

Usage : python3 demo/generer.py   → demo/pdfs/*.pdf
Nécessite Google Chrome ou Chromium (impression HTML → PDF, sans dépendance Python).
Toutes les entités sont fictives ; chaque page porte le filigrane « SPÉCIMEN — FICTIF ».
"""
from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

OUT = Path(__file__).resolve().parent / "pdfs"

CSS = """
@page { size: A4; margin: 22mm 20mm 20mm; }
* { box-sizing: border-box; }
body { font: 11pt/1.5 "DejaVu Serif", Georgia, serif; color: #111; margin: 0; }
/* pas de ligatures : « fi », « ff » doivent rester des lettres pour la lecture et la recherche */
* { font-variant-ligatures: none !important; font-feature-settings: "liga" 0, "clig" 0 !important; }
.page { position: relative; page-break-after: always; min-height: 250mm; }
.page:last-child { page-break-after: auto; }
.wm { position: absolute; top: 38%; left: -5%; width: 110%; text-align: center; transform: rotate(-30deg);
      font: 700 46pt/1 "DejaVu Sans", Arial, sans-serif; color: rgba(180, 35, 24, 0.12); letter-spacing: 4px; z-index: -1; }
.head { display: flex; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 18px;
        font: 9pt/1.4 "DejaVu Sans", Arial, sans-serif; }
.head b { font-size: 10pt; }
h1 { font: 700 17pt/1.25 "DejaVu Sans", Arial, sans-serif; margin: 0 0 6px; }
h2 { font: 700 13pt/1.3 "DejaVu Sans", Arial, sans-serif; margin: 18px 0 8px; }
h3 { font: 700 11pt/1.3 "DejaVu Sans", Arial, sans-serif; margin: 14px 0 6px; }
table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; font-size: 10pt; }
td, th { border: 1px solid #555; padding: 5px 7px; text-align: left; vertical-align: top; }
th { background: #eee; }
.box { border: 1.5px solid #111; padding: 12px 14px; margin: 14px 0; }
.foot { position: absolute; bottom: 0; left: 0; right: 0; border-top: 1px solid #999; padding-top: 6px;
        font: 8pt/1.4 "DejaVu Sans", Arial, sans-serif; color: #555; display: flex; justify-content: space-between; }
.sign { margin-top: 36px; text-align: right; }
.stamp { display: inline-block; border: 2px dashed #555; padding: 10px 18px; font: 700 9pt "DejaVu Sans", sans-serif; color: #555; transform: rotate(-4deg); }
.cover { text-align: center; padding-top: 30mm; }
.cover h1 { font-size: 22pt; margin: 18px 0; }
.small { font-size: 9pt; color: #444; }
"""

FICTIF = "Document fictif créé pour la démonstration de MemoPli — sans valeur légale."


def page(body: str, num: int, total: int, ref: str) -> str:
    return f"""<section class="page"><div class="wm">SPÉCIMEN — FICTIF</div>{body}
<div class="foot"><span>{ref} · {FICTIF}</span><span>Page {num} / {total}</span></div></section>"""


def doc(title: str, pages: list[str], ref: str) -> str:
    total = len(pages)
    html = "".join(page(b, i + 1, total, ref) for i, b in enumerate(pages))
    return f"<!doctype html><html lang='fr'><head><meta charset='utf-8'><title>{title}</title><style>{CSS}</style></head><body>{html}</body></html>"


# ----------------------------------------------------------------- l'appel d'offres

ACHETEUR = "Commune de Lagunaville (collectivité fictive)"
HEAD_DAO = f"""<div class="head"><div><b>{ACHETEUR}</b><br>Direction des services techniques<br>BP 000 · Lagunaville</div>
<div style="text-align:right">Appel d'offres ouvert<br><b>N° AO-2026/014/CL/DST</b><br>Publié le 12 novembre 2026</div></div>"""

DAO = [
    # 1 — couverture
    f"""{HEAD_DAO}<div class="cover"><p>DOSSIER D'APPEL D'OFFRES (DAO)</p>
<h1>Réhabilitation de 4,2 km de voirie urbaine<br>dans le quartier Akpakpa-Sud</h1>
<p>Marché de travaux · Lot unique</p>
<div class="box" style="text-align:left;max-width:140mm;margin:24px auto">
<p><b>Maître d'ouvrage :</b> {ACHETEUR}</p>
<p><b>Date limite de dépôt des offres :</b> le 18 décembre 2026 à 10 h 00 (heure locale), au secrétariat de la Direction des services techniques.</p>
<p><b>Ouverture des plis :</b> le 18 décembre 2026 à 10 h 30, en séance publique.</p>
<p><b>Délai d'exécution maximal :</b> huit (8) mois à compter de l'ordre de service.</p>
<p><b>Montant prévisionnel du marché :</b> 1 250 000 000 FCFA TTC.</p></div>
<p class="small">Le présent dossier comprend 8 pages numérotées. Toute offre incomplète sera écartée.</p></div>""",
    # 2 — objet
    f"""{HEAD_DAO}<h2>Chapitre I — Objet et consistance des travaux</h2>
<p>Le présent appel d'offres a pour objet la réhabilitation de 4,2 kilomètres de voirie urbaine dans le quartier
Akpakpa-Sud de la commune de Lagunaville. Les travaux visent à rétablir la circulation en toute saison, à améliorer
l'assainissement pluvial et à sécuriser les déplacements piétons.</p>
<h3>1.1 Consistance des travaux</h3>
<p>Les travaux comprennent, à titre indicatif : le décapage et la reprise de la couche de forme sur 4,2 km ; la mise en
œuvre d'un revêtement en béton bitumineux sur 32 000 mètres carrés ; la construction de 1 800 mètres linéaires de
caniveaux en béton armé ; l'installation de 120 candélabres solaires ; la signalisation horizontale et verticale.</p>
<h3>1.2 Calendrier</h3>
<p>Le titulaire devra démarrer les travaux dans les quinze (15) jours suivant la notification de l'ordre de service.
Le délai global d'exécution ne pourra excéder huit (8) mois, saison des pluies comprise.</p>
<h3>1.3 Visite de site</h3>
<p>Une visite de site facultative est organisée le 26 novembre 2026 à 9 h 00. Le point de rassemblement est fixé devant
la mairie annexe d'Akpakpa-Sud.</p>""",
    # 3 — garantie, montant
    f"""{HEAD_DAO}<h2>Chapitre II — Garanties et conditions financières</h2>
<h3>2.1 Garantie de soumission</h3>
<p>Le soumissionnaire joint à son offre une garantie de soumission d'un montant égal à deux pour cent (2 %) du montant
prévisionnel du marché, soit vingt-cinq millions (25 000 000) de francs CFA. Elle est émise par une banque ou un
établissement financier agréé et reste valable trente (30) jours au-delà de la durée de validité des offres.</p>
<h3>2.2 Validité des offres</h3>
<p>Les offres restent valables pendant quatre-vingt-dix (90) jours à compter de la date limite de dépôt.</p>
<h3>2.3 Garantie de bonne exécution</h3>
<p>L'attributaire constitue, avant la signature du marché, une garantie de bonne exécution égale à cinq pour cent (5 %)
du montant du marché.</p>
<h3>2.4 Avance de démarrage</h3>
<p>Une avance de démarrage plafonnée à quinze pour cent (15 %) du montant du marché peut être accordée contre une
garantie de remboursement d'un montant équivalent.</p>""",
    # 4 — pièces administratives
    f"""{HEAD_DAO}<h2>Chapitre III — Conditions de participation et pièces administratives</h2>
<p>Le soumissionnaire doit produire, sous peine d'élimination, les pièces administratives suivantes :</p>
<table><tr><th>N°</th><th>Pièce exigée</th><th>Condition</th></tr>
<tr><td>1</td><td>Attestation de régularité fiscale</td><td>datant de moins de trois mois, en cours de validité</td></tr>
<tr><td>2</td><td>Attestation de régularité sociale (CNSS)</td><td>à jour des cotisations, en cours de validité</td></tr>
<tr><td>3</td><td>Extrait du registre du commerce et du crédit mobilier (RCCM)</td><td>de moins d'un an</td></tr>
<tr><td>4</td><td>Garantie de soumission</td><td>conforme à l'article 2.1</td></tr>
<tr><td>5</td><td>Déclaration sur l'honneur de non-exclusion</td><td>signée par le représentant légal</td></tr></table>
<p>Toute pièce dont la date de validité est dépassée à la date limite de dépôt est considérée comme absente.</p>""",
    # 5 — capacités techniques et financières
    f"""{HEAD_DAO}<h2>Chapitre IV — Capacités techniques et financières</h2>
<h3>4.1 Références</h3>
<p>Le soumissionnaire justifie d'au moins deux (2) références de travaux de voirie ou de génie civil similaires réalisés
au cours des cinq (5) dernières années, chacune d'un montant supérieur à 300 000 000 FCFA, attestées par des procès-verbaux
de réception ou des attestations de bonne fin.</p>
<h3>4.2 Capacité financière</h3>
<p>Le soumissionnaire produit les états financiers (bilans) des deux derniers exercices, certifiés par un expert-comptable,
faisant apparaître un chiffre d'affaires annuel moyen d'au moins 800 000 000 FCFA.</p>
<h3>4.3 Personnel clé</h3>
<p>Un conducteur de travaux (ingénieur génie civil, 8 ans d'expérience minimum), deux chefs de chantier et un
responsable qualité-sécurité-environnement.</p>
<h3>4.4 Matériel</h3>
<p>Une niveleuse, un compacteur, un finisseur, deux camions-bennes et un laboratoire de chantier (en propre ou en location).</p>""",
    # 6 — critères de notation
    f"""{HEAD_DAO}<h2>Chapitre V — Critères d'évaluation des offres</h2>
<p>Les offres administrativement conformes sont évaluées sur 100 points selon la grille suivante :</p>
<table><tr><th>Critère</th><th>Pondération</th></tr>
<tr><td>Note méthodologique et organisation du chantier</td><td>40 points (40 %)</td></tr>
<tr><td>Prix de l'offre</td><td>35 points (35 %)</td></tr>
<tr><td>Références et qualification du personnel</td><td>15 points (15 %)</td></tr>
<tr><td>Délai d'exécution proposé</td><td>10 points (10 %)</td></tr></table>
<h3>5.1 Note méthodologique</h3>
<p>La note méthodologique, de dix (10) pages au maximum, présente : la compréhension du besoin, l'organisation du chantier,
les moyens humains et matériels, le planning d'exécution et la gestion des risques (pluies, circulation, riverains).</p>
<h3>5.2 Délai</h3>
<p>Un délai d'exécution inférieur à huit mois apporte jusqu'à 10 points, au prorata, sans pouvoir descendre sous six mois.</p>""",
    # 7 — présentation des offres
    f"""{HEAD_DAO}<h2>Chapitre VI — Présentation et dépôt des offres</h2>
<p>L'offre est remise sous pli fermé en un original et deux copies, et comprend trois enveloppes distinctes :</p>
<p><b>Enveloppe A</b> — pièces administratives (chapitre III) ;<br><b>Enveloppe B</b> — offre technique : références,
personnel, matériel et note méthodologique (chapitres IV et V) ;<br><b>Enveloppe C</b> — offre financière : soumission,
bordereau des prix unitaires et devis quantitatif estimatif.</p>
<p>Les offres sont déposées au plus tard le 18 décembre 2026 à 10 h 00. Les offres reçues après cette heure ne sont pas ouvertes.</p>
<h3>6.1 Langue et monnaie</h3><p>Les offres sont rédigées en français ; les prix sont exprimés en francs CFA.</p>""",
    # 8 — rappel
    f"""{HEAD_DAO}<h2>Chapitre VII — Rappel des pièces à fournir</h2>
<p>Attestation fiscale ; attestation CNSS ; extrait RCCM ; garantie de soumission de 2 % ; deux références de marchés
similaires sur cinq ans ; bilans des deux derniers exercices ; déclaration sur l'honneur ; note méthodologique de dix pages au maximum.</p>
<p>Fait à Lagunaville, le 12 novembre 2026.</p>
<div class="sign"><p>Le Directeur des services techniques<br>(nom fictif)</p><span class="stamp">SPÉCIMEN</span></div>""",
]

# ------------------------------------------------------------------- les pièces

ENT = "Entreprise Adjovi BTP SARL (entreprise fictive)"
ENT_LINES = "IFU 3202400001234 (fictif) · RCCM RB/LGV/24 B 1204 (fictif)"


def piece(org: str, title: str, lines: str, body: str, ref: str) -> str:
    head = f"""<div class="head"><div><b>{org}</b><br>Service de délivrance · Lagunaville</div>
<div style="text-align:right">Réf. <b>{ref}</b></div></div>"""
    return doc(title, [f"{head}<h1>{title}</h1>{lines}{body}"], ref)


def kv(rows: list[tuple[str, str]]) -> str:
    return "<table>" + "".join(f"<tr><th style='width:42%'>{k}</th><td>{v}</td></tr>" for k, v in rows) + "</table>"


SIGN = '<div class="sign"><p>Pour le service (signature fictive)</p><span class="stamp">SPÉCIMEN</span></div>'

PIECES = {
    "02-attestation-fiscale.pdf": piece(
        "Administration fiscale (spécimen)", "Attestation de régularité fiscale", "",
        f"<p>L'administration certifie que l'entreprise ci-dessous est en règle vis-à-vis de ses obligations fiscales.</p>"
        + kv([("Entreprise", ENT), ("Identifiants", ENT_LINES), ("Date de délivrance", "2 novembre 2026"),
              ("Valable jusqu'au", "28 février 2027")]) + SIGN, "AF-2026-08812"),
    "03-attestation-cnss-EXPIREE.pdf": piece(
        "Caisse de sécurité sociale (spécimen)", "Attestation de régularité sociale (CNSS)", "",
        "<p>La caisse certifie que l'employeur ci-dessous est à jour de ses déclarations et cotisations sociales.</p>"
        + kv([("Employeur", ENT), ("Numéro employeur", "CSS-0045 1278 (fictif)"), ("Date de délivrance", "1er avril 2026"),
              ("Valable jusqu'au", "30 septembre 2026")]) + SIGN, "CSS-2026-01937"),
    "04-attestation-cnss-RENOUVELEE.pdf": piece(
        "Caisse de sécurité sociale (spécimen)", "Attestation de régularité sociale (CNSS)", "",
        "<p>La caisse certifie que l'employeur ci-dessous est à jour de ses déclarations et cotisations sociales.</p>"
        + kv([("Employeur", ENT), ("Numéro employeur", "CSS-0045 1278 (fictif)"), ("Date de délivrance", "20 novembre 2026"),
              ("Valable jusqu'au", "31 mars 2027")]) + SIGN, "CSS-2026-04410"),
    "05-extrait-rccm.pdf": piece(
        "Registre du commerce (spécimen)", "Extrait du registre du commerce et du crédit mobilier", "",
        kv([("Dénomination", ENT), ("Forme juridique", "Société à responsabilité limitée"), ("Immatriculation", "RB/LGV/24 B 1204 (fictif)"),
            ("Activité", "Bâtiment et travaux publics"), ("Date de l'extrait", "15 octobre 2026"), ("Valable jusqu'au", "15 octobre 2027")]) + SIGN,
        "RCCM-EX-2026-3321"),
    "06-reference-voirie-2024.pdf": piece(
        "Commune de Port-Lagune (collectivité fictive)", "Attestation de bonne fin d'exécution", "",
        "<p>Le maître d'ouvrage atteste que les travaux ci-dessous ont été exécutés conformément au marché et réceptionnés sans réserve.</p>"
        + kv([("Titulaire", ENT), ("Objet", "Réhabilitation de 3,6 km de voirie urbaine, quartier Lagune-Est"), ("Montant", "985 000 000 FCFA TTC"),
              ("Délai contractuel", "7 mois"), ("Réception définitive", "12 septembre 2024"),
              ("Moyens mobilisés", "1 conducteur de travaux, 2 chefs d'équipe, 3 équipes de pose, laboratoire externe")]) + SIGN,
        "REF-2024-PL-07"),
    "07-reference-ecoles-2023.pdf": piece(
        "Commune de Collines-Basses (collectivité fictive)", "Attestation de bonne fin d'exécution", "",
        "<p>Le maître d'ouvrage atteste que les travaux ci-dessous ont été exécutés conformément au marché et réceptionnés sans réserve.</p>"
        + kv([("Titulaire", ENT), ("Objet", "Construction de deux salles de classe avec bureau et magasin"), ("Montant", "312 000 000 FCFA TTC"),
              ("Délai contractuel", "5 mois"), ("Réception définitive", "30 juin 2023")]) + SIGN,
        "REF-2023-CB-02"),
    "08-bilans-2024-2025.pdf": piece(
        "Cabinet d'expertise comptable Lagune Audit (fictif)", "États financiers certifiés — exercices 2024 et 2025", "",
        "<table><tr><th>Poste (FCFA)</th><th>2024</th><th>2025</th></tr>"
        "<tr><td>Chiffre d'affaires</td><td>842 000 000</td><td>918 000 000</td></tr>"
        "<tr><td>Résultat net</td><td>41 500 000</td><td>52 300 000</td></tr>"
        "<tr><td>Capitaux propres</td><td>214 000 000</td><td>256 000 000</td></tr>"
        "<tr><td>Effectif moyen</td><td>22</td><td>24</td></tr></table>"
        "<p>Nous certifions que les états financiers ci-dessus sont réguliers et sincères. Certification valable jusqu'au 30 juin 2027.</p>" + SIGN,
        "LA-CERT-2026-118"),
    "09-garantie-soumission.pdf": piece(
        "Banque Lagunaire de Développement (établissement fictif)", "Garantie de soumission", "",
        "<p>La banque se porte garante, à première demande, au profit du maître d'ouvrage ci-dessous.</p>"
        + kv([("Donneur d'ordre", ENT), ("Bénéficiaire", ACHETEUR), ("Marché", "AO-2026/014/CL/DST — voirie Akpakpa-Sud"),
              ("Montant garanti", "25 000 000 FCFA (2 % du montant prévisionnel)"), ("Valable jusqu'au", "17 avril 2027")]) + SIGN,
        "BLD-GS-2026-5520"),
    "10-declaration-sur-honneur.pdf": piece(
        ENT, "Déclaration sur l'honneur de non-exclusion", "",
        "<p>Je soussigné, gérant de l'entreprise ci-dessous, déclare sur l'honneur que l'entreprise n'est frappée d'aucune "
        "mesure d'exclusion des marchés publics, n'est pas en liquidation judiciaire et a satisfait à ses obligations fiscales et sociales.</p>"
        + kv([("Entreprise", ENT), ("Marché", "AO-2026/014/CL/DST — voirie Akpakpa-Sud"), ("Fait à", "Lagunaville, le 20 novembre 2026"),
              ("Valable jusqu'au", "18 mars 2027 (durée de validité de l'offre)")]) + SIGN,
        "DH-2026-014"),
    "11-personnel-cle.pdf": piece(
        ENT, "Personnel clé proposé", "",
        "<table><tr><th>Fonction</th><th>Nom (fictif)</th><th>Qualification</th><th>Expérience</th></tr>"
        "<tr><td>Conducteur de travaux</td><td>K. Houénou</td><td>Ingénieur génie civil</td><td>11 ans</td></tr>"
        "<tr><td>Chef de chantier</td><td>A. Dossou</td><td>Technicien supérieur BTP</td><td>9 ans</td></tr>"
        "<tr><td>Chef de chantier</td><td>R. Agbo</td><td>Technicien supérieur BTP</td><td>7 ans</td></tr>"
        "<tr><td>Responsable QSE</td><td>M. Ahouandjinou</td><td>Licence QHSE</td><td>6 ans</td></tr></table>"
        "<p>CV détaillés et attestations de disponibilité joints à l'offre technique. Liste valable pour la durée de l'offre.</p>" + SIGN,
        "PC-2026-014"),
    "12-liste-materiel.pdf": piece(
        ENT, "Liste du matériel affecté au chantier", "",
        "<table><tr><th>Matériel</th><th>Quantité</th><th>Statut</th></tr>"
        "<tr><td>Niveleuse</td><td>1</td><td>en propre</td></tr><tr><td>Compacteur vibrant</td><td>1</td><td>en propre</td></tr>"
        "<tr><td>Finisseur</td><td>1</td><td>en location (contrat joint)</td></tr><tr><td>Camions-bennes</td><td>2</td><td>en propre</td></tr>"
        "<tr><td>Laboratoire de chantier</td><td>1</td><td>en propre</td></tr></table>" + SIGN,
        "MAT-2026-014"),
}


def render(html: str, target: Path, chrome: str) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "doc.html"
        src.write_text(html, encoding="utf-8")
        subprocess.run(
            [chrome, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", f"--user-data-dir={tmp}/profil",
             f"--print-to-pdf={target}", src.as_uri()],
            check=True, capture_output=True, timeout=120,
        )


def main() -> None:
    chrome = shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")
    if not chrome:
        raise SystemExit("Chrome ou Chromium est nécessaire pour générer les PDF.")
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = {"01-appel-offres-voirie-lagunaville.pdf": doc("DAO AO-2026/014", DAO, "AO-2026/014/CL/DST"), **PIECES}
    for name, html in jobs.items():
        render(html, OUT / name, chrome)
        print("✓", name)


if __name__ == "__main__":
    main()
