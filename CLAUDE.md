# Paie Juste — règles pour travailler sur ce dépôt

Appli web installable (PWA) pour salariés du privé : noter ses heures, vérifier sa paie, réclamer.
« Je travaille, je note mes heures, Paie Juste vérifie ma paie. »

## Principes non négociables

1. **Aucune IA dans le calcul.** Les montants viennent de règles explicites dans `js/calc.js`, avec une source officielle et un test. Une IA peut lire, expliquer, proposer : jamais calculer un salaire. L'appli fonctionne sans IA et sans réseau.
2. **Les données restent sur le téléphone.** Pas de compte, pas de serveur, pas de statistiques. Rien n'est envoyé sans un geste de la personne (copier, partager, imprimer). Une sauvegarde sort chiffrée (`js/sauvegarde.js`).
3. **Rien ne s'efface.** Le journal est en ajout seul et chaîné en SHA-256 (`js/chain.js`, `js/db.js`). Une modification = une correction scellée avec motif.
4. **Pas de promesse juridique.** Toujours « estimation, à vérifier », « ce n'est pas un conseil juridique ». Aucun courrier n'est envoyé automatiquement.
5. **Simple pour un ouvrier sur un chantier.** Français clair, peu de texte, gros boutons, heures en 24 h. Voir le skill `ux-chantier`.

## Technique

- Page statique sans étape de build : `index.html`, `js/`, `css/`, `sw.js`, `vendor/` (pdf.js, tesseract.js embarqués, empreintes dans `vendor/SHA256SUMS`).
- Hébergement : Netlify (`netlify.toml`). Chemins relatifs : l'appli doit aussi marcher sous `/Paie-juste/`.
- Pas de React, pas de backend, pas de base distante : ne pas en ajouter sans une décision explicite du propriétaire.

## Vérifications avant chaque push

```bash
npm run lint && npm run typecheck && npm run format:check
npm run coverage        # tests de règles, seuil 90 %
npm run test:urssaf     # comparaison au moteur officiel de l'Urssaf
python3 -m http.server 8781 &  # puis, sous un dossier qui contient le dépôt sous le nom Paie-juste :
node tests/browser.mjs http://127.0.0.1:8781/Paie-juste/
```

Les tests navigateur régénèrent `captures/` et `tests/fixtures/contrat-texte.pdf` : ne garder que les captures des écrans modifiés, compressées (< 300 Ko).

## Compétences (skills)

Dans `.claude/skills/` : `regle-paie`, `lecture-bulletin`, `journal-scelle`, `courrier-reclamation`, `ux-chantier`, `livraison`. Charger celle qui correspond à la tâche avant de commencer.
