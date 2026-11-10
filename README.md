# Paie Juste — pointer · vérifier · réclamer (v0.1)

Appli web installable (PWA), sous **licence MIT**, en français, qui fonctionne **hors ligne**, sans compte, sans serveur et sans CDN. Elle s'adresse à **tout salarié du privé** : CDI, CDD, intérim, temps partiel, payé à l'heure ou au mois.
**Aucune donnée ne quitte le téléphone** : tout est stocké dans IndexedDB, et les exports se font uniquement à votre demande.

> Estimation, à vérifier. **Ce n'est pas un conseil juridique.** Règles, sources et limites : `../regles.md`.

## Onglets
- **Pointer** : gros bouton Début / Pause / Reprendre, bouton Fin, compteur en direct, GPS facultatif et refusable. Chaque pointage est scellé dans une chaîne SHA-256. Une correction ou un oubli s'**ajoute**, avec un motif obligatoire, et l'original reste visible.
- **Ma paie** : ce que vous allez toucher ce mois (brut, net, impôt), heures par semaine, calcul attendu ligne par ligne, saisie du bulletin, puis grand compteur « L'agence / votre employeur vous doit X € » ou « Tout est en ordre ».
- **Réclamer** : ① demande amiable, ② mise en demeure chiffrée avec les articles cités, ③ relevé scellé en annexe. Vous pouvez copier, imprimer ou enregistrer en PDF. Contacts vérifiés à Montpellier. **Rien n'est envoyé automatiquement.**
- **Contrat** : type, salaire horaire ou mensuel, heures par semaine, convention (texte libre), primes. « Ajouter le contrat automatiquement » lit un PDF (pdf.js) ou une photo (OCR tesseract.js, français), **sur le téléphone**, et chaque champ proposé est à valider.
- **⋯ Données** : export JSON et CSV, import vérifié (refusé si la chaîne est rompue), vérification de la chaîne, mode **EXEMPLE** (base séparée, bandeau rayé), effacement.

## Architecture (modulaire)
`js/app.js` contient le registre `MODULES` (un onglet = un objet `{id, label, render(ctx, el)}`). On pourra y brancher plus tard la Boîte noire bruit/vibrations (`/workspace/temoin/pwa/`), qui utilise la même chaîne (`js/chain.js`, reprise telle quelle).
Calculs purs, sans DOM : `calc.js`, `compute.js`, `contrat-parse.js`, `letters.js`, `export.js`.

## Tests
- `node tests/run.mjs` : 70 tests unitaires sur des cas calculés à la main (heures sup, heures complémentaires, mensuel, CDD, IFM et ICCP, net au SMIC, chaîne, falsification, exemple, extraction de contrat).
- `node tests/browser.mjs http://127.0.0.1:PORT/` : parcours dans Chrome headless, captures 390 × 844, import PDF et OCR, vérification qu'aucune requête ne sort de l'appli. Ce test demande puppeteer-core, installé hors du dépôt dans `/tmp/libs`.

## Lancer en local
`python3 -m http.server 8781` dans ce dossier, puis ouvrir http://127.0.0.1:8781/ (ajouter `?exemple=1` pour la démo). Sur un téléphone, Chrome exige **https** pour la géolocalisation et l'installation : la publication n'a **pas** été faite (refusée pour l'instant).
