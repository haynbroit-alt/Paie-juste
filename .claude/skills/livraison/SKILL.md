---
name: livraison
description: Préparer une nouvelle version de Paie Juste et l'ouvrir en pull request — numéro de version, cache du service worker, CHANGELOG, vérifications complètes, captures, PR. À utiliser avant chaque push qui change l'appli.
---

# Livraison d'une version

## 1. Version (trois endroits, toujours ensemble)

- `js/version.js` → `APP_VERSION`
- `sw.js` → `VERSION = "paie-juste-vX.Y.Z"` (sinon les téléphones gardent l'ancien cache)
- `package.json` → `npm pkg set version=X.Y.Z && npm i --package-lock-only`

Nouveau fichier JS ? L'ajouter à la liste `CORE` de `sw.js` (sinon il manque hors ligne) et, s'il est pur, à `tsconfig.json`.

## 2. Vérifications (toutes, dans cet ordre)

```bash
npm run lint && npm run typecheck && npm run format:check
npm run coverage
npm run test:urssaf
node tests/browser.mjs http://127.0.0.1:8781/Paie-juste/   # servi sous /Paie-juste/
```

Un test rouge n'est jamais désactivé ni assoupli pour passer : on corrige la cause.

## 3. Fichiers régénérés

`tests/browser.mjs` réécrit `captures/` et `tests/fixtures/contrat-texte.pdf`. Garder seulement les captures des écrans modifiés, les compresser (palette 128 couleurs, < 300 Ko), et restaurer le reste (`git checkout -- …`).

## 4. CHANGELOG

Une entrée datée, en français simple, qui commence par ce que la personne y gagne. Toujours une phrase sur les montants : « Les montants de paie ne changent pas » ou l'exemple chiffré avant / après.

## 5. Pull request

Brouillon, sur la branche de travail, en suivant `.github/PULL_REQUEST_TEMPLATE.md` (Quoi / Calculs de paie / Vérifications), avec les chiffres réels des tests. Netlify publie un aperçu `deploy-preview-N--…netlify.app` : le donner au propriétaire pour qu'il teste sur son téléphone avant la fusion.
