# Sécurité

Paie Juste ne possède pas de serveur et ne crée pas de compte. Les pointages, le contrat et les bulletins restent dans le navigateur (IndexedDB). Un export n'a lieu que si la personne le demande.

## Ce qui est en place

- Content-Security-Policy dans la page : scripts, styles, connexions et workers limités à l'origine. `connect-src 'self'` interdit les appels réseau. `frame-ancestors` n'est pas dans cette balise : un navigateur ignore cette directive quand elle arrive par une balise, et GitHub Pages ne permet pas d'ajouter l'en-tête HTTP correspondant. Les liens vers les textes officiels sont des navigations, pas des envois.
- Bibliothèques pdf.js et tesseract.js embarquées dans `vendor/`. Le fichier `vendor/SHA256SUMS` est vérifié par `node tests/run.mjs`.
- Chaque saisie est ajoutée à une chaîne SHA-256. Une modification ou une suppression se voit. Ce n'est pas une signature qualifiée.
- Le service worker ne met en cache que l'application elle-même. Une nouvelle version remplace les caches précédents (`skipWaiting`, `clients.claim`).

## Signaler un problème

Ouvrez un ticket GitHub en décrivant la version (`0.1.1`), le navigateur, et ce que vous observez. N'y joignez pas de bulletin de paie réel ni de donnée personnelle : un exemple fictif suffit.

Cette application produit une estimation. Ce n'est pas un conseil juridique.
