# Dossier de démonstration MemoPli

Jeu de PDF **entièrement fictifs** pour la présentation : une commune, une entreprise, des
administrations et une banque inventées. Chaque page porte le filigrane « SPÉCIMEN — FICTIF »
et la mention « sans valeur légale ». Les PDF ont du texte sélectionnable (MemoPli ne lit pas
les scans sans OCR).

Régénérer : `python3 demo/generer.py` (nécessite Chrome ou Chromium).

## Contenu de `pdfs/`

| Fichier | À saisir dans « Mes documents » | Type | Valable jusqu'au |
|---|---|---|---|
| `01-appel-offres-voirie-lagunaville.pdf` | — à déposer dans « Nouveau dossier » (8 pages) | — | — |
| `02-attestation-fiscale.pdf` | Attestation de régularité fiscale | Attestation fiscale | 28/02/2027 |
| `03-attestation-cnss-EXPIREE.pdf` | Attestation CNSS | Attestation CNSS | **30/09/2026** (expirée) |
| `04-attestation-cnss-RENOUVELEE.pdf` | *(sert au remplacement, voir étape 5)* | — | 31/03/2027 |
| `05-extrait-rccm.pdf` | Extrait RCCM | Registre du commerce | 15/10/2027 |
| `06-reference-voirie-2024.pdf` | Référence de marché similaire : voirie Lagune-Est, 3,6 km, 985 M FCFA (2024) | Référence de chantier | *(laisser vide)* |
| `07-reference-ecoles-2023.pdf` | Référence de marché similaire : deux salles de classe, 312 M FCFA (2023) | Référence de chantier | *(laisser vide)* |
| `08-bilans-2024-2025.pdf` | Bilans 2024-2025 certifiés | Bilan | 30/06/2027 |
| `09-garantie-soumission.pdf` | Garantie de soumission 2 % | Autre | 17/04/2027 |
| `10-declaration-sur-honneur.pdf` | Déclaration sur l'honneur de non-exclusion | Autre | 18/03/2027 |
| `11-personnel-cle.pdf` | Personnel clé proposé (conducteur de travaux, chefs de chantier, QSE) | Autre | 18/03/2027 |
| `12-liste-materiel.pdf` | Liste du matériel affecté au chantier | Autre | 18/03/2027 |

Les intitulés comptent : l'IA rapproche chaque exigence d'un document **par son intitulé, son type
et sa date** (jamais par son contenu). Reprendre ceux du tableau.

## Déroulé de la présentation (≈ 5 min)

1. **Compte** — créer un compte (ex. `demo2@memopli.bj`), entreprise « Entreprise Adjovi BTP ».
   Compléter « Mon entreprise » : IFU `3202400001234`, RCCM `RB/LGV/24 B 1204`, secteur
   « Bâtiment, travaux publics », effectif `24`.
2. **Documents** — ajouter les pièces 02, 03, 05 à 12 avec les intitulés et dates du tableau.
   La cloche affiche l'attestation CNSS expirée ; « Votre dossier type » se remplit.
3. **Appel d'offres** — « Nouveau dossier » → déposer `01-appel-offres-…pdf` → « Relever les
   exigences » (≈ 30 s). Attendu : 13 exigences, chacune avec sa page (pièces p. 4-5, critères
   p. 6 : 40 / 35 / 15 / 10 %), acheteur « Commune de Lagunaville », date limite 18 décembre 2026.
4. **Vérifier mon dossier** — attendu : **Pas prêt · 1 blocage : Attestation CNSS expirée**.
5. **Remplacer** — dans « Mes documents », « Remplacer » sur l'attestation CNSS : date
   `31/03/2027`, fichier `04-attestation-cnss-RENOUVELEE.pdf`. Revenir au dossier, « Vérifier à
   nouveau » : **Prêt à déposer**.
6. **Rédiger la méthodologie** (≈ 30 s) — le texte cite les vraies références (voirie Lagune-Est
   2024, 985 M FCFA), marque « à compléter » ce qui manque et se termine par « Proposition à
   relire et à adapter avant signature ».
7. **Demander à Pli** — « Quelle garantie de soumission est demandée ? » → « 2 % … soit
   25 000 000 FCFA [p. 3] ». Cliquer sur la pastille p. 3 pour montrer le passage.

## Résultats mesurés (répétition du 25/11/2026, environnement de test)

| Étape | Résultat | Coût |
|---|---|---|
| Relever les exigences | 13 exigences, pages correctes, date limite 2026-12-18 | 15 FCFA |
| Vérifier (CNSS expirée) | Pas prêt, 1 blocage : CNSS | — |
| Vérifier (CNSS renouvelée) | Prêt, 0 blocage | — |
| Rédiger la méthodologie | 4 574 caractères, références citées | 9 FCFA |
| **Total (5 appels)** | | **41 FCFA** |

## Plan B

- Si l'IA ne répond pas : l'écran affiche un message clair, rien n'est inventé ; relancer.
- Si une autre pièce que la CNSS bloque : vérifier son intitulé (tableau ci-dessus) et sa date.
- Les dates sont calculées à partir d'aujourd'hui : après le 30/09/2026 la CNSS « 03 » est
  expirée, c'est voulu ; après le 18/12/2026 la date limite du DAO est dépassée (régénérer avec
  d'autres dates dans `generer.py`).
