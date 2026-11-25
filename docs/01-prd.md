# PRD — Soumission

**Produit :** le poste de travail des appels d'offres pour les PME.
**Version :** MVP (Phase 3 du Capstone RodiumAi, livraison 25/11/2026).
**Équipe :** Roger AGONSANOU (lead), Elpidio Alexis AMOUSSOU (produit), Fernandez KOUAGOU (tech), Sèna ALLOWANOU (business).

---

## 1. Le problème

Une PME de Cotonou qui répond à un appel d'offres repart de zéro à chaque dossier. Les pièces sont dispersées, les dates de validité oubliées, et le travail réel — **le mémoire technique** — prend cinq à dix jours.

Deux conséquences mesurables :

| Fait | Chiffre | Source |
|---|---|---|
| Entreprises de BTP au Bénin | 1 594, dont 1 087 modernes | INStaD, RGE3 2023 |
| Formalisation du BTP | 70,1 % avec IFU | INStaD, RGE3 2023 |
| Commande publique annuelle | ≈ 800 milliards FCFA | ADPME Bénin |
| Part réservée aux PME | 20 %, cible 30-35 % | ARMP, 4 nov. 2026 |
| Recours recevables mais mal fondés | 85 % | ARMP, 4 nov. 2026 |
| Dossiers déposés par an (cas de contrôle, ONG) | ≈ 35, dont 1 sur 3 retenu | entretien, nov. 2026 |

**Ce n'est pas un problème de vérification.** Vérifier une liste de pièces prend dix minutes avec une feuille. Le problème dur est la **production** : rédiger 40 à 80 pages structurées sur la grille d'évaluation du bailleur, avec ses propres références.

## 2. La cible

**Utilisateur :** « Adjovi », 38 ans, responsable administrative et financière d'une PME de BTP de Cotonou, 10 à 50 salariés. Seule sur les dossiers, 2 à 4 candidatures par mois, Word/Excel/Gmail, pas de budget logiciel.

**Décideur / payeur :** le dirigeant, qui autorise la candidature et paie.

**Marché d'entrée :** BTP à Cotonou. **Extension :** toute PME qui répond à des appels d'offres (fournitures, services, conseil, ONG).

## 3. Jobs to be done

1. *Quand un appel d'offres tombe, je veux savoir en 5 minutes s'il me concerne et si je suis éligible, pour ne pas perdre trois jours sur un dossier perdu d'avance.*
2. *Quand je décide de répondre, je veux un mémoire technique déjà structuré sur les critères du bailleur, pour ne pas repartir d'une page blanche.*
3. *Avant de déposer, je veux être certain qu'aucune pièce ne manque et qu'aucune date n'est dépassée, pour ne pas être éliminé pour une broutille.*

## 4. Proposition de valeur

> Tu déposes le dossier d'appel d'offres et tes références. Deux heures plus tard, tu as un mémoire technique structuré sur la grille d'évaluation du bailleur, écrit avec tes chantiers réels, prêt à relire et à signer.

## 5. Périmètre du MVP

Cinq écrans, un parcours, aucune fonctionnalité décorative.

| # | Écran | Ce qu'il fait |
|---|---|---|
| 1 | **Compte & entreprise** | création de compte, raison sociale, IFU, RCCM, secteur, effectif |
| 2 | **Coffre** | dépôt de pièces (attestation fiscale, CNSS, RCCM, références, bilans) avec date d'expiration |
| 3 | **Dépôt du DAO** | upload PDF (ou collage d'un extrait), extraction lancée |
| 4 | **Grille & exigences** | liste des pièces exigées et des critères de notation avec pondération, chaque ligne liée à sa page |
| 5 | **Production** | état « Prêt / Pas prêt », et génération d'une section du mémoire (méthodologie) |

### Dans le MVP

- Extraction des exigences et de la grille de notation, **avec la page source**.
- Rapprochement exigences ↔ coffre → statut `valide` / `périmé` / `manquant`.
- Blocage du bouton « Prêt à déposer » tant qu'une pièce obligatoire manque ou est périmée.
- Génération d'**une** section du mémoire (méthodologie / organisation), à partir des références du coffre.
- Un seul utilisateur par compte, un seul dossier à la fois.

### Hors MVP

- Génération du mémoire complet (toutes sections).
- Radar d'opportunités (multi-sources, scraping).
- Dépôt électronique chez le bailleur.
- Multi-utilisateurs, rôles, facturation réelle.
- OCR des DAO scannés (à faire si le temps le permet — voir risques).

## 6. Exigences fonctionnelles

| ID | Exigence | Priorité |
|---|---|---|
| F1 | Créer un compte (e-mail + mot de passe) et une entreprise | P0 |
| F2 | Déposer une pièce avec type et date d'expiration | P0 |
| F3 | Uploader un DAO (PDF texte) et en extraire le texte | P0 |
| F4 | Extraire les exigences (pièces, critères, pondérations) avec page | P0 |
| F5 | Rapprocher chaque exigence du coffre et calculer le statut | P0 |
| F6 | Afficher « Prêt / Pas prêt » avec la liste des blocages | P0 |
| F7 | Générer une section du mémoire à partir des références | P0 |
| F8 | Corriger manuellement une exigence mal extraite | P1 |
| F9 | Exporter la checklist de conformité en PDF | P1 |
| F10 | OCR de secours pour un DAO scanné | P2 |

## 7. Règles métier

- Une pièce **périmée** (date dépassée) est traitée comme **manquante**.
- Une pièce sans date d'expiration déclarée est `à vérifier`, jamais `valide`.
- Le bouton de validation reste **désactivé** tant qu'il reste une exigence `manquant` ou `périmé` marquée obligatoire.
- Le code calcule les dates et les totaux ; le modèle ne fait que lire et rédiger.
- Toute valeur extraite est affichée avec sa **page source** ; l'utilisateur peut la corriger, et sa correction prime.

## 8. L'IA dans le produit

| Tâche | Modèle (API RodiumAi) | Garde-fou |
|---|---|---|
| Extraire exigences + grille de notation du DAO | Claude Haiku 4.5 | JSON validé par schéma ; page obligatoire ; sinon « non extrait » |
| Rapprocher exigences et pièces du coffre | Gemini 3.5 Flash-Lite | le code applique les statuts et les dates |
| Rédiger la section méthodologie | Claude Haiku 4.5 | génération à partir des seules références du coffre ; mention « à relire » |

**Quand l'IA se trompe :** source affichée, correction possible, « je ne sais pas » si le document ne contient pas l'information, repli si l'API ne répond pas (message explicite, pas de résultat inventé).

## 9. Non-fonctionnel

- **Temps perçu :** extraction < 60 s pour un DAO de 80 pages ; génération d'une section < 30 s.
- **Coût :** viser < 100 FCFA d'appels modèle par dossier (mesuré pendant la démo).
- **Sécurité :** clés en variables d'environnement, jamais dans le bundle ; isolation par `org_id` ; fichiers servis par URL signée ; pièces jamais envoyées au modèle (seuls les intitulés et les métadonnées).
- **Robustesse :** `/health`, journaux avec `request_id`, message clair si l'IA échoue.

## 10. Ce que la démo doit prouver

1. Un DAO réel est déposé, les exigences sortent **en 30 secondes** avec leur page.
2. L'écran affiche **« Pas prêt »** à cause d'une pièce périmée — puis **« Prêt »** après remplacement.
3. Une section du mémoire est générée, écrite avec **les chantiers réels** du coffre, pas du texte générique.
4. Le coût de l'opération est annoncé à l'écran.

## 11. Risques

| Risque | Mitigation |
|---|---|
| Le DAO est un scan → pas de texte | OCR Tesseract en secours (F10) ; sinon annoncer la limite |
| Extraction incomplète de la grille | afficher la page source, permettre la correction, dire « non extrait » |
| Mémoire générique | n'autoriser la génération qu'avec au moins deux références dans le coffre |
| Manque de temps | la section générée est unique ; le reste est décrit dans le canevas comme « suite » |

## 12. Définition de « fini » pour ce soir

- Le parcours des 5 écrans fonctionne de bout en bout, en ligne, sur un autre appareil.
- Un DAO réel et trois pièces réelles sont chargés.
- Un utilisateur extérieur a testé et on a noté où il a bloqué.
- Le dépôt de code est lisible, avec un README qui permet de relancer en local.
