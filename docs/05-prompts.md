# Prompts et garde-fous

## 1. Extraction des exigences

**Entrée :** début du texte du DAO, chapitré (`--- PAGE 12 ---`).

**Sortie attendue :** JSON strict.

```json
{
  "title": "string|null",
  "buyer": "string|null",
  "deadline": "YYYY-MM-DD|null",
  "requirements": [
    { "label": "Attestation de régularité fiscale",
      "kind": "piece",
      "mandatory": true,
      "page": 12,
      "excerpt": "phrase exacte du document",
      "confidence": 0.93 }
  ],
  "grid": [
    { "label": "Méthodologie et organisation", "weight": 0.30, "page": 41, "excerpt": "..." }
  ]
}
```

**Règles passées au modèle :**
- n'invente aucune exigence : si elle n'est pas écrite, elle n'existe pas ;
- `page` et `excerpt` obligatoires, sinon `confidence < 0.5` ;
- les critères chiffrés (chiffre d'affaires, références, effectifs) sont conservés tels quels, sans les interpréter ;
- si le document ne contient pas la grille de notation, renvoyer `grid: []` — ne rien deviner.

**Garde-fous code :** validation du schéma, rejet si `page` manquante, `deadline` re-parsée en date réelle.

## 2. Rapprochement exigence ↔ pièce

**Entrée :** la liste des exigences + la liste des pièces (intitulé, type, date).

**Sortie :** pour chaque exigence, l'`id` de la pièce correspondante ou `null`, et une raison courte.

**Interdit :** décider du statut. Le modèle dit « cette pièce correspond » ; le code dit `valide`, `perime` ou `a_verifier`.

## 3. Rédaction de la méthodologie

**Entrée :** objet du marché, grille de notation, et les 3 références les plus proches du coffre (intitulé, année, montant, description).

**Sortie :** 600 à 900 mots, en français, structurés en : compréhension du besoin → organisation du chantier → moyens humains et matériels → planning → gestion des risques.

**Règles :**
- n'utilise **que** les références fournies ; si une information manque, écris « à compléter » plutôt que d'inventer ;
- pas de superlatifs, pas de promesses non vérifiables ;
- terminer par la mention « Proposition à relire et à adapter avant signature ».

## Modèles

| Tâche | Modèle | Pourquoi |
|---|---|---|
| Extraction | Claude Haiku 4.5 | rapide, bon sur documents longs, JSON fiable |
| Rapprochement | Gemini 3.5 Flash-Lite | peu coûteux, suffisant pour un appariement |
| Rédaction | Claude Haiku 4.5 | qualité de rédaction, coût maîtrisé |
