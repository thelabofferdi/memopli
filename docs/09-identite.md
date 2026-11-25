# Identité MemoPli

Ce document est la référence : les valeurs ci-dessous sont celles du code
(`frontend/src/styles.css`, `frontend/src/components/Logo.jsx`). Si l'une change,
elle change aux deux endroits.

## Le nom

**MemoPli**, en un seul mot, deux capitales : `Memo` + `Pli`.
Jamais « Memo Pli », jamais « MEMOPLI », jamais « MémoPli » (l'accent casse le
domaine `memopli.com`).

- *memo* : le mémoire technique, le livrable que la PME doit produire ;
- *pli* : le pli, le dossier cacheté qu'on remet au bailleur dans le vocabulaire
  des marchés publics.

Le nom se prononce « mé-mo-pli » en français et « MEH-mo-plee » en anglais.

## Le signe

Un **M plein, plié en accordéon**, sur une tuile au **coin corné**. Les deux
moitiés du M ne prennent pas la même lumière : la face gauche est éclairée
(blanc), la face droite est dans l'ombre du pli (`--brand-light`). C'est le
moment où le dossier devient une soumission. Le coin corné reprend la même
teinte : c'est une feuille. Formes pleines, aucun trait : le signe tient à 16 px.

Géométrie (viewBox 32) partagée par `Logo.jsx`, `favicon.svg` et `public/brand/*.svg` :
tuile `M7 0H23L32 9V25A7 7 0 0 1 25 32H7A7 7 0 0 1 0 25V7A7 7 0 0 1 7 0Z`,
coin `M23 0V6A3 3 0 0 0 26 9H32Z`, M en deux faces (`M_LEFT`, `M_RIGHT`).

| Fichier | Variante | Usage |
|---|---|---|
| `frontend/public/brand/memopli-mark.svg` | `brand` : tuile outremer, faces blanc / bleu clair | fond clair, défaut |
| `frontend/public/brand/memopli-mark-paper.svg` | `paper` : tuile papier, faces encre / outremer | fond outremer ou encre |
| `frontend/public/brand/memopli-mark-mono.svg` | `mono` : une seule encre | tampons, fax, documents administratifs |
| `frontend/public/favicon.svg` | `brand` | onglet du navigateur |
| `frontend/src/components/Logo.jsx` | `<Mark variant />`, `<Wordmark />` | React |

Le logotype : « Memo » encre + « Pli » outremer, Bricolage Grotesque **800**,
interlettrage −0,035 em.

Règles : taille minimale 16 px ; ne pas déformer ; ne pas changer les teintes
des faces ; ne jamais poser le signe sur un aplat vert, rouge ou ambre (ces
teintes appartiennent aux statuts, voir plus bas).

## La couleur

| Variable | Valeur | Rôle | Contraste vérifié |
|---|---|---|---|
| `--ink` | `#0b1020` | texte, structure, ombres portées | 17,37:1 sur crème |
| `--cream` | `#f7f5ef` | fond de page | — |
| `--cream-2` | `#efece4` | sections alternées de la landing | — |
| `--paper` | `#ffffff` | cartes, champs | — |
| `--muted` | `#5b6275` | texte secondaire | 5,59:1 sur crème |
| `--brand` | `#2b3ae0` | **outremer du pli** : tuile du signe, « Pli », boutons principaux, surtitres, aplats de marque | 6,92:1 sur crème, 7,54:1 blanc dessus |
| `--brand-deep` | `#1f2bb0` | survol des boutons de marque | — |
| `--brand-light` | `#a9b2ff` | face d'ombre du M, coin corné, texte de marque sur encre | 9,47:1 sur encre |
| `--brand-soft` | `#eceeff` | fonds bleutés discrets, étiquettes de page | — |
| `--ok` | `#0b6e4f` | statut `valide`, verdict prêt | 5,53:1 sur son fond |
| `--ko` | `#b42318` | statuts `périmée` / `manquante`, verdict pas prêt | 5,75:1 |
| `--warn` | `#b45309` | statut `à vérifier`, valeur non extraite | 4,57:1 |

**La règle qui compte :** le bleu est la marque, jamais un statut ; le vert, le
rouge et l'ambre sont des statuts, jamais la marque. Un écran peut être bleu,
il ne doit jamais être vert « pour faire joli ». Sur la landing, le vert et le
rouge n'apparaissent que dans les maquettes de l'outil, où ils sont des statuts.

Pourquoi l'outremer plutôt que l'ancien bleu de Prusse (`#1b4a6b`) : il tient
les mêmes contrastes en affirmant la marque, et ne se confond avec aucun statut.

## La mascotte

**Pli**, une feuille de dossier au coin corné (`frontend/src/components/Mascot.jsx`),
SVG pur : contours `--ink`, corps papier, pli `--brand-light`, visa `--brand`.
Elle salue d'une main, brandit le visa de l'autre, et porte l'étiquette « p. 12 »
(chaque valeur porte sa page). Le visa est **bleu, jamais vert**. Usage : page
publique uniquement, jamais dans les écrans de travail. Animations coupées sous
`prefers-reduced-motion`. Elle ne remplace pas le signe.

## L'espacement

Base 4 px, une seule échelle : `--s1` 4 · `--s2` 8 · `--s3` 12 · `--s4` 16 ·
`--s5` 24 · `--s6` 32 · `--s7` 48 · `--s8` 64 · `--s9` 96. Rayons : `--r1` 8 ·
`--r2` 12 · `--r3` 20 · `--r4` 28. Sur la landing, aucune marge ni aucun
remplissage hors de cette échelle. Sections : 96 px (64 px sous 640 px) ; titre
de section → contenu : 48 px ; surtitre → titre : 16 px ; titre → chapô : 24 px.

## La typographie

| Rôle | Police | Réglage |
|---|---|---|
| Titres, logotype, chiffres clés | **Bricolage Grotesque** | 800 en affichage, 700 dans l'app ; interlettrage −0,02 à −0,045 em |
| Texte, champs, boutons, tableaux | **Geist** | 400 et 500 |
| Code, identifiants | mono système | 12 px |

Les deux familles viennent de Google Fonts, sous **SIL OFL 1.1**, et sont
auto-hébergées dans `frontend/public/fonts` (aucun appel à un CDN à
l'exécution). Les licences sont dans le même dossier, `OFL-*.txt`.

Tailles d'affichage de la page publique : `h1` `clamp(44px, 5.6vw, 76px)` en
800, `h2` de section `clamp(32px, 4vw, 52px)` en 800, chapô 18 px (19 px dans le
hero). Dans l'app, `h2` reste
à 19 px : c'est un outil, pas une plaquette.

## Ce qui reste à faire

- un signe dessiné par un graphiste, si le projet continue au-delà du MVP ;
- une image de partage (`og:image`) en 1200 × 630, qui manque encore.
