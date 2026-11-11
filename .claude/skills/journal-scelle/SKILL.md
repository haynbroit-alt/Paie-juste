---
name: journal-scelle
description: Toucher aux données de Paie Juste — journal scellé SHA-256, corrections, export, import, sauvegarde chiffrée, réglages (META_KEYS), base IndexedDB. À utiliser pour tout changement dans js/chain.js, js/db.js, js/export.js, js/sauvegarde.js, deriveState, ou pour ajouter un nouveau type d'enregistrement.
---

# Journal scellé, sauvegarde et vie privée

Le journal est la preuve personnelle du salarié. S'il casse, la preuve casse.

## Invariants

- **Ajout seul.** On n'écrit jamais par-dessus un enregistrement. Modifier = ajouter une `correction` (`targetId`, `motif` obligatoire, `changes` ou `annule`). L'original reste visible.
- **Chaîne.** Chaque enregistrement contient l'empreinte SHA-256 du précédent (`js/chain.js`). `verifyChain` doit rester vrai après toute opération, et un import ou une restauration dont la chaîne est rompue est **refusé**.
- **Compatibilité.** Les anciens journaux (pointages en direct, `mission`/`missionId`) doivent toujours être lus par `deriveState` et `resumeJournees`. Ne jamais renommer un champ déjà scellé : ajouter un alias à la lecture.
- **Nouveau type d'enregistrement** : le gérer dans `deriveState`, l'export CSV (`buildCsv`), l'annexe du courrier si pertinent, et ajouter un test de chaîne.

## Réglages hors journal

- Toute clé `setMeta` qui doit survivre au redémarrage va dans `META_KEYS` (`js/sauvegarde.js`) : elle est alors relue à l'ouverture (`js/app.js`) **et** incluse dans la sauvegarde.
- Oubli déjà arrivé une fois (horaires « comme d'habitude » perdus au redémarrage) : tester en rechargeant la page dans `tests/browser.mjs`.

## Sauvegarde chiffrée

- AES-256-GCM, clé PBKDF2-SHA-256 à 600 000 itérations minimum, sel et IV aléatoires à chaque sauvegarde. Ne pas baisser ces paramètres. Pour les relever, garder la lecture des anciens fichiers (les paramètres sont écrits dans le fichier).
- Aucune donnée en clair dans le fichier. Le code ne quitte jamais la page et n'est pas stocké.
- Tests : aller-retour, mauvais code, fichier modifié, aléa (`tests/run.mjs`) et parcours complet sauvegarder → effacer → restaurer (`tests/browser.mjs`).

## Vie privée (RGPD)

- Pas de serveur, pas de compte, pas de statistiques, pas de police ni de script externe (CSP dans `index.html`, test dans `tests/security.mjs`).
- Le service worker ne cite aucune URL externe.
- Le GPS reste facultatif et refusable ; aucun son n'est jamais enregistré.
- Ajouter un service en ligne = décision du propriétaire, avec chiffrement côté téléphone avant tout envoi.
