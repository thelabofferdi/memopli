# Démonstration et test utilisateur

## Avant la démo

L'API exige une session (`AUTH_REQUIRED=true`). Le compte de démonstration possède
l'entreprise « BTP Adjovi » et son dossier déjà extrait :

- identifiant : `demo@memopli.bj` (mot de passe communiqué à l'oral, jamais écrit ici) ;
- recréer le compte si besoin, puis rattacher l'entreprise :

```bash
env PYTHONPATH=backend DATABASE_PATH=data/app.db UPLOAD_DIR=data/uploads \
  ./.venv/bin/python -c "
from app import auth; from app.db import connect
c = auth.create_account('demo@memopli.bj', '<mot de passe>', None)
with connect() as conn:
    conn.execute('UPDATE organizations SET user_id=? WHERE id=?', (c['user']['id'], 'org_demo01'))
"
```

## Script de la vidéo (2 min 30)

1. **0:00 — le problème.** « Une PME de Cotonou passe cinq jours sur un mémoire technique, et perd parfois le marché pour une signature manquante. »
2. **0:10 — la connexion.** On se connecte : l'espace montre l'entreprise et ses dossiers.
3. **0:15 — le coffre.** L'entreprise dépose trois pièces ; l'attestation CNSS est périmée, elle est marquée en rouge.
4. **0:40 — le DAO.** Dépôt du PDF ; extraction des exigences en 30 secondes, chaque ligne avec sa page.
5. **1:10 — l'écran de décision.** « Pas prêt » : deux blocages. On remplace l'attestation, l'écran passe au vert.
6. **1:35 — la production.** Génération de la section méthodologie, écrite avec les chantiers réels de l'entreprise.
7. **2:10 — le coût.** « Ce dossier a coûté X FCFA d'appels modèle. »

## Test utilisateur (à faire avant la soumission)

- **Qui :** une personne de la cible, extérieure à l'équipe (profil issu des entretiens de la phase 1).
- **Comment :** on lui donne le lien, on ne l'aide pas, on chronomètre.
- **À noter :** le temps pour déposer un DAO, l'endroit où elle hésite, ce qu'elle cherche et ne trouve pas, sa réaction à l'écran « Pas prêt ».
- **Après :** on corrige au moins un point, et on l'écrit dans le canevas (section 6).
