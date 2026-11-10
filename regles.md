# Règles de paie retenues — Paie Juste (v0.1)

> **Changement de périmètre (10/11/2026, 10 h 34, heure de Paris) :** l'appli s'adresse à **tous les salariés du privé** (CDI, CDD, intérim, temps partiel), et plus seulement aux intérimaires. Nom proposé : **Paie Juste** (« pointer · vérifier · réclamer »). Les règles intérim ci-dessous restent valables ; les sections 1 bis et 1 ter ajoutent les autres contrats et le passage du brut au net.

**Vérifié le :** mardi 10 novembre 2026 (heure de Paris).
**Pour :** Lhassan Charfa (Montpellier) et tout salarié du privé.
**Méthode :** j'ai ouvert chaque texte pendant cette session. Les copies brutes sont dans `interim/sources/`.
Les articles viennent du **Code du travail numérique** (code.travail.gouv.fr, site du ministère du Travail, qui reprend le texte de Légifrance), et les fiches de **service-public.gouv.fr**.
**Étiquettes :** PROUVÉ = lu sur une source officielle et codé ; INCONNU = non vérifié sur une source officielle, donc **rien n'est codé en dur** et l'utilisateur saisit la valeur ; CONFLIT = des sources se contredisent ; ÉCHEC = je n'ai pas pu ouvrir la source.

> Ce document n'est pas un conseil juridique. Une convention collective ou un accord peut prévoir mieux que la loi ; l'appli calcule un **minimum légal estimé**.

## 1. Règles PROUVÉES et codées

| Règle | Ce que dit le texte (extrait) | Comment l'appli l'applique | Source |
|---|---|---|---|
| **IFM** — L1251-32 | « Cette indemnité est égale à 10 % de la rémunération totale brute due au salarié. » Versée « à l'issue de chaque mission ». | IFM = 10 % × brut de la mission (base + heures sup + primes que vous marquez comme « salaire »). Arrondi au centime. | [L1251-32](https://code.travail.gouv.fr/code-du-travail/l1251-32) · [service-public F11215](https://www.service-public.gouv.fr/particuliers/vosdroits/F11215) (vérifié le 19 juin 2026) |
| **IFM non due** — L1251-33 | Pas due en cas de rupture anticipée à l'initiative du salarié, de faute grave ou de force majeure ; ni si un CDI est conclu tout de suite avec l'entreprise utilisatrice (L1251-32). | Au moment de « Terminer la mission », vous choisissez le motif. Si c'est un cas d'exclusion, l'appli met l'IFM à 0 €. | [L1251-33](https://code.travail.gouv.fr/code-du-travail/l1251-33) |
| **ICCP** — L1251-19 | « ne peut être inférieur au dixième de la rémunération totale brute perçue par le salarié pendant la mission ». Service-public : « (indemnité de fin de mission comprise) ». | ICCP = 10 % × (brut + IFM). Due pour chaque mission, quelle que soit sa durée. | [L1251-19](https://code.travail.gouv.fr/code-du-travail/l1251-19) · [service-public F11215](https://www.service-public.gouv.fr/particuliers/vosdroits/F11215) |
| **Durée légale** — L3121-27 | « fixée à trente-cinq heures par semaine ». | Seuil hebdomadaire par défaut : 35 h. | [L3121-27](https://code.travail.gouv.fr/code-du-travail/l3121-27) |
| **Décompte par semaine** — L3121-29, L3121-35 | « Les heures supplémentaires se décomptent par semaine. » La semaine va « du lundi à 0 heure » au « dimanche à 24 heures », sauf accord. | Les heures sont cumulées du lundi au dimanche, en heure de Paris. | [L3121-29](https://code.travail.gouv.fr/code-du-travail/l3121-29) · [L3121-35](https://code.travail.gouv.fr/code-du-travail/l3121-35) |
| **Majorations des heures sup** — L3121-36 | « A défaut d'accord » : +25 % « pour chacune des huit premières heures supplémentaires », +50 % pour les suivantes. Service-public : « de la 36e à la 43e heure », puis « à partir de la 44e heure » (vérifié le 8 juin 2026). | Valeurs **par défaut** : de la 36e à la 43e heure +25 %, puis +50 %. **Vous pouvez les modifier** dans les réglages de la mission, car un accord peut fixer un autre taux (au moins 10 %, L3121-33). | [L3121-36](https://code.travail.gouv.fr/code-du-travail/l3121-36) · [L3121-33](https://code.travail.gouv.fr/code-du-travail/l3121-33) · [service-public F2391](https://www.service-public.gouv.fr/particuliers/vosdroits/F2391) |
| **Égalité de salaire avec l'entreprise utilisatrice** — L1251-18, L1251-43 6° | La rémunération ne peut être inférieure à celle du contrat de mise à disposition, qui doit indiquer ce que percevrait « un salarié de qualification professionnelle équivalente occupant le même poste ». | Champ facultatif « taux de référence de l'entreprise utilisatrice ». S'il est plus élevé que votre taux, l'appli calcule l'écart. **Le taux lui-même n'est pas connu de l'appli** : c'est vous qui le saisissez. | [L1251-18](https://code.travail.gouv.fr/code-du-travail/l1251-18) · [L1251-43](https://code.travail.gouv.fr/code-du-travail/l1251-43) · [service-public F11215](https://www.service-public.gouv.fr/particuliers/vosdroits/F11215) |
| **Prescription des salaires** — L3245-1 | « se prescrit par trois ans » ; la demande peut porter sur « les trois dernières années », ou les trois années avant la rupture. | L'appli signale les périodes de plus de 3 ans et cite l'article dans les courriers. | [L3245-1](https://code.travail.gouv.fr/code-du-travail/l3245-1) · [L1471-1](https://code.travail.gouv.fr/code-du-travail/l1471-1) (les actions en paiement du salaire ne relèvent pas du délai de 2 ans) |
| **Bulletin accepté sans rien dire** — L3243-3 | Accepter un bulletin sans protester ne vaut pas renonciation au salaire dû. | Phrase reprise dans les courriers. | [L3243-3](https://code.travail.gouv.fr/code-du-travail/l3243-3) |
| **Preuve des heures** — L3171-4 | En cas de litige, l'employeur fournit les horaires ; le juge décide au vu de ces éléments « et de ceux fournis par le salarié ». | C'est pour ça que les pointages sont scellés et joints en annexe. **Attention :** le relevé reste un élément parmi d'autres, ce n'est pas une preuve automatique. | [L3171-4](https://code.travail.gouv.fr/code-du-travail/l3171-4) |
| **Durée de travail = règles de l'entreprise utilisatrice** — L1251-21 | L'entreprise utilisatrice est responsable de la durée du travail selon les règles « applicables au lieu de travail ». | Information seulement : un accord de l'entreprise utilisatrice peut changer les seuils. C'est pourquoi les taux restent modifiables. | [L1251-21](https://code.travail.gouv.fr/code-du-travail/l1251-21) |


## 1 bis. Autres contrats — PROUVÉ et codé

| Règle | Ce que dit le texte (extrait) | Dans l'appli | Source |
|---|---|---|---|
| **CDD : indemnité de fin de contrat** — L1243-8 | « égale à 10 % de la rémunération totale brute versée au salarié », sauf si le CDD se poursuit en CDI. | Précarité = 10 % du brut (taux **réglable**). | [L1243-8](https://code.travail.gouv.fr/code-du-travail/l1243-8) |
| **CDD : 6 % possible** | Service-public : le pourcentage « peut être limité à 6 % par convention collective », avec des contreparties en formation (page vérifiée le 22 janvier 2024). | Taux de précarité modifiable dans le contrat. | [service-public F40](https://www.service-public.gouv.fr/particuliers/vosdroits/F40) |
| **CDD : précarité non due** — L1243-10 | Rupture anticipée à l'initiative du salarié, faute grave, force majeure, refus d'un CDI équivalent, jobs de vacances, etc. | Motif à choisir à la fin du contrat (0 € si exclusion). | [L1243-10](https://code.travail.gouv.fr/code-du-travail/l1243-10) |
| **CDD : congés payés** — L1242-16 | ICCP d'au moins « le dixième de la rémunération totale brute perçue », si les congés n'ont pas pu être pris. | ICCP 10 %, sauf si vous cochez « j'ai pris tous mes congés ». | [L1242-16](https://code.travail.gouv.fr/code-du-travail/l1242-16) |
| **CDI** | Pas d'indemnité de fin de contrat ni d'ICCP mensuelle (les congés se prennent). | Pas de ligne de fin. | — |
| **Temps partiel : définition** — L3123-1 | Durée inférieure à la durée légale (ou conventionnelle). | Temps partiel si moins de 35 h par semaine au contrat. | [L3123-1](https://code.travail.gouv.fr/code-du-travail/l3123-1) |
| **Heures complémentaires : majoration** — L3123-8, L3123-29 | « Chacune des heures complémentaires accomplies donne lieu à une majoration. » À défaut d'accord, « 10 % » dans la limite du dixième des heures du contrat, « 25 % » entre le dixième et le tiers. | Tranches +10 % puis +25 % (taux **réglables**, un accord de branche peut fixer au moins 10 %, L3123-21). | [L3123-29](https://code.travail.gouv.fr/code-du-travail/l3123-29) · [L3123-21](https://code.travail.gouv.fr/code-du-travail/l3123-21) · [service-public F32428](https://www.service-public.gouv.fr/particuliers/vosdroits/F32428) |
| **Heures complémentaires : limites** — L3123-28, L3123-20, L3123-9 | Au plus 1/10 des heures du contrat (jusqu'au 1/3 par accord), sans jamais atteindre la durée légale. | **Alerte** si une semaine dépasse le tiers ou atteint 35 h. | [L3123-28](https://code.travail.gouv.fr/code-du-travail/l3123-28) · [L3123-20](https://code.travail.gouv.fr/code-du-travail/l3123-20) · [L3123-9](https://code.travail.gouv.fr/code-du-travail/l3123-9) |
| **Mensualisation** — L3242-1 | Pour la durée légale, rémunération mensuelle = taux horaire × « 52/12 de la durée légale hebdomadaire » (151,67 h). | Salaire mensuel : taux horaire déduit = mensuel ÷ (heures du contrat × 52/12). Les heures prévues au contrat sont réputées payées par le mensuel ; seules les heures en plus sont ajoutées. | [L3242-1](https://code.travail.gouv.fr/code-du-travail/l3242-1) |

## 1 ter. Brut → net et impôt — PROUVÉ (taux officiels 2026)

Source : [service-public F2302 « Cotisations salariales »](https://www.service-public.gouv.fr/particuliers/vosdroits/F2302), vérifiée le 1er janvier 2026, concordante avec la page [URSSAF des taux du secteur privé](https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/taux-cotisations-secteur-prive.html) (mise à jour le 1er janvier 2026, lue par recherche ; l'ouverture directe par curl a échoué).

| Cotisation salariale | Assiette | Taux codé |
|---|---|---|
| Vieillesse plafonnée | jusqu'à 4 005 € par mois | 6,90 % |
| Vieillesse déplafonnée | tout le salaire | 0,40 % |
| Agirc-Arrco tranche 1 / CEG tranche 1 | jusqu'à 4 005 € | 3,15 % / 0,86 % |
| Agirc-Arrco tranche 2 / CEG tranche 2 | de 4 005 € à 32 040 € | 8,64 % / 1,08 % |
| CET (si le salaire dépasse 4 005 €) | tranches 1 et 2 | 0,14 % |
| APEC (cadres, option) | jusqu'à 16 020 € | 0,024 % |
| CSG (dont 2,4 % non déductibles) | 98,25 % du brut | 9,2 % |
| CRDS (non déductible) | 98,25 % du brut | 0,5 % |
| Chômage, part salariale | — | 0 % (« supprimée totalement depuis le 1er octobre 2018 ») |
| Maladie Alsace-Moselle (option) | tout le salaire | 1,30 % (URSSAF) |

- **Réduction sur les heures sup** : **PROUVÉ** ([service-public F2391](https://www.service-public.gouv.fr/particuliers/vosdroits/F2391)) : « exonérées des cotisations salariales d'assurance vieillesse de base et complémentaire dans la limite de 11,31 % ». Elle est codée pour les heures supplémentaires. **INCONNU** pour les heures complémentaires : je ne l'ai pas vérifié, donc elle n'est pas appliquée.
- **Net imposable** = net avant impôt + CSG non déductible + CRDS (F2302 : « non déductibles du revenu imposable »).
- **Exonération d'impôt des heures sup (7 500 € par an)** : la page F2391 l'indique, mais avec un exemple daté de 2022. Elle reste donc en **option** (décochée par défaut).
- **Prélèvement à la source** : c'est **vous qui saisissez le taux** (il figure sur votre bulletin ou dans votre espace impots.gouv). L'appli calcule taux × net imposable.
- **Contrôle** : au SMIC du 1er juin 2026 (1 867,02 € brut, [service-public F2301](https://www.service-public.gouv.fr/particuliers/vosdroits/F2301)), l'appli trouve 389,09 € de cotisations, 1 477,93 € net et 1 531,12 € net imposable. Ces trois montants concordent avec un calcul publié par un site non officiel (purpay.fr), qui dit retrouver « le SMIC net indicatif publié par service-public ». Ce test automatique fait partie de `tests/run.mjs`.
- **INCONNU, non codé (saisie libre)** : mutuelle et prévoyance (montant mensuel saisi), part patronale de la mutuelle réintégrée dans le net imposable, taux réduits, apprentis, salariés de 65 ans et plus, exonérations particulières, régularisation annuelle du plafond. **Le net reste une estimation.**

## 1 quater. Lecture automatique du contrat — ce qui est fait

- **PDF texte** : pdf.js 4.10.38 (Apache-2.0), embarqué dans `app/vendor/pdfjs/`. **PROUVÉ en test** : PDF généré → taux, agence, entreprise utilisatrice et 39 h extraits.
- **Photo / PDF scanné** : tesseract.js 5.1.1 + moteur LSTM + données `fra` « best_int » (Apache-2.0), embarqués dans `app/vendor/tesseract/` (≈ 8,5 Mo, chargés au premier usage puis gardés en cache). **PROUVÉ en test** sur une photo propre générée (légèrement tournée) : CDD, 13,20 €/h, employeur et dates reconnus. **INCONNU** : la qualité sur une vraie photo de chantier (pli, ombre, flou) et la vitesse sur un téléphone Android d'entrée de gamme.
- **Repli** : coller le texte du contrat. Chaque champ trouvé est **proposé** avec l'extrait d'origine, et rien n'est enregistré sans validation.
- Les champs sont extraits par des **expressions régulières simples** : type, taux horaire, salaire mensuel, heures par semaine ou par mois, dates, employeur, entreprise utilisatrice, lieu, poste, convention. Une mise en page inhabituelle peut faire rater un champ.

## 1 quinquies. Demande d'accès à ses données (RGPD) — PROUVÉ

Source : [règlement (UE) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj?locale=fr), articles 12 et 15, et pages de la CNIL [« L'accès à son dossier professionnel »](https://www.cnil.fr/fr/lacces-son-dossier-professionnel) et [« Exercer son droit d'accès »](https://www.cnil.fr/fr/modele/courrier/exercer-son-droit-dacces), lues par recherche le 10/11/2026.

- Le salarié peut obtenir confirmation que l'employeur traite des données le concernant, et une copie de ces données (art. 15).
- Réponse dans un mois à compter de la réception, prolongeable de deux mois si la demande est complexe, à condition d'en informer le salarié dans le premier mois (art. 12, CNIL).
- La première copie est gratuite (art. 12 et 15, CNIL).
- Le droit d'accès ne couvre pas les données des autres salariés (CNIL).
- Sans réponse, plainte possible auprès de la CNIL.
- **INCONNU** : que l'agence d'intérim conserve bien les relevés transmis par l'entreprise utilisatrice. Le courrier les demande, il ne prétend pas qu'ils existent.

## 2. INCONNU — non codé en dur, à saisir à la main

| Sujet | Pourquoi INCONNU | Dans l'appli |
|---|---|---|
| **Taux des heures sup dans la convention des ouvriers du bâtiment** (IDCC 1596/1597) et dans l'accord de l'entreprise utilisatrice | La fiche officielle du ministère (PDF travail-emploi.gouv.fr) est **ÉCHEC** : elle est bloquée par une vérification anti-robot. LégiSocial (site **non officiel**) indique 25 % puis 50 %, comme la loi. | Taux modifiables par mission. Valeurs par défaut : celles de la loi (L3121-36). |
| **Panier (indemnité de repas), transport, trajet — petits déplacements BTP** | Le principe existe dans les conventions des ouvriers du bâtiment (titre VIII, zones de 10 km). Les **montants** sont fixés par des **accords régionaux** (Occitanie), que je n'ai pas pu ouvrir sur une source officielle. Sources lues, **non officielles** : LégiSocial, Sancy Avocats. | Rubrique « Primes et indemnités » : libellé + montant + nombre de jours, saisis par vous. **Aucun montant n'est fourni.** |
| **Ces indemnités entrent-elles dans la base de l'IFM et de l'ICCP ?** | Je n'ai trouvé aucune source officielle qui tranche ligne par ligne (une indemnité de frais n'est en principe pas du salaire). | Une case par prime : « compte dans la base IFM/ICCP ». Cochée par défaut pour une prime, décochée pour un remboursement de frais. C'est vous qui décidez. |
| **Travail de nuit, dimanche, jours fériés, intempéries** | Les majorations dépendent des conventions et accords. Elles n'ont pas été vérifiées. | Pas calculées. Vous pouvez les saisir comme primes. |
| **Heures d'équivalence, annualisation, horaire de 39 h avec heures sup déjà comprises** | Dépend de l'accord de l'entreprise utilisatrice. | Pas géré automatiquement. Le seuil de 35 h reste modifiable. |
| **Méthode du maintien de salaire pour l'ICCP** (si elle donne plus que 1/10) | Pas vérifiée. | Seul le minimum de 1/10 est calculé. |
| **CDD : la précarité entre-t-elle dans la base de l'ICCP ?** | Aucune source officielle ouverte ne le dit pour le CDD (pour l'intérim, oui : service-public F11215). | Case « inclure la précarité dans la base des congés », décochée par défaut. |
| **Salaire mensuel et absences, ou mois avec heures en moins** | Les retenues pour absence et les règles d'annualisation ne sont pas codées. | Le mensuel est compté en entier. |
| **Jours fériés dans la projection du mois** | Non déduits (ex. 11 novembre). | Projection = jours ouvrés restants × (heures par semaine ÷ 5), marquée « estimation ». |
| **Jurisprudence sur la valeur d'un relevé fait avec une appli** | Aucune décision trouvée (voir `etat-de-l-art.md`). | Le texte de l'appli dit « élément de preuve, à apprécier par le juge ». |

## 3. CONFLIT

- **Base de l'ICCP.** L'article L1251-19 parle de la rémunération « perçue pendant la mission ». Il ne dit pas en toutes lettres que l'IFM est comprise, mais service-public le dit. Ce n'est pas un vrai conflit : la fiche officielle précise la règle. **Retenu :** IFM comprise.
- **Fiche de la convention collective du BTP.** La source officielle est en ÉCHEC et seule une source non officielle a pu être lue. Les valeurs concordent, mais je n'ai pas pu le confirmer officiellement. Voir la section 2.

## 4. ÉCHEC

- `travail-emploi.gouv.fr` (« La rémunération de l'intérimaire » et fiche PDF de la convention 1597) : bloqué par une page « Vérification de sécurité » (captcha), avec WebFetch comme avec curl.
- Légifrance : seul un test d'ouverture a été fait (L3121-1), et il a réussi. Les textes des articles ont été lus sur code.travail.gouv.fr, qui affiche la date de mise à jour de chaque article.

## 5. Contacts d'aide vérifiés (onglet Réclamer), valables pour tout salarié du privé

Le service de renseignement en droit du travail « informe, conseille et oriente les salariés et les employeurs de droit privé », tous contrats confondus (herault.gouv.fr). Le conseil de prud'hommes juge les litiges entre un salarié et son employeur, quel que soit le contrat.

| Contact | Coordonnées | Source |
|---|---|---|
| Service de renseignement en droit du travail — DDETS de l'Hérault (réseau DREETS Occitanie) | 615 boulevard d'Antigone, CS 19002, 34064 Montpellier Cedex 2 · 0 806 000 126 (lun.-ven. 9 h-11 h 30 et 13 h 30-16 h) · ddets-droit-du-travail-renseignements@herault.gouv.fr · accueil sur rendez-vous | [annuaire service-public](https://lannuaire.service-public.gouv.fr/occitanie/herault/e2f3a3cd-edd3-4733-94d8-23c08c8c46b7) · [DREETS Occitanie](https://occitanie.dreets.gouv.fr/travail-info) |
| DREETS Occitanie (siège) | 1 place Émile Blouin, CS 90007, 31952 Toulouse Cedex 9. Le renseignement en droit du travail se fait dans les DDETS départementales. | [DREETS — nous contacter](https://occitanie.dreets.gouv.fr/contact-18711) |
| Conseil de prud'hommes de Montpellier | 9 rue de Tarragone, 34000 Montpellier (postal : 34040 Montpellier Cedex 1) · 04 34 08 32 00 · cph-montpellier@justice.fr · lun.-ven. 8 h-12 h et 13 h 30-16 h 30 | [annuaire service-public](https://lannuaire.service-public.gouv.fr/occitanie/herault/651c531c-ff94-4d52-828d-0e1c778e3171) · [justice.fr](https://www.justice.fr/annuaire/conseil-prud-hommes-montpellier) |
| Union départementale CGT de l'Hérault | Maison des syndicats, 474 allée Henri II de Montmorency, 34000 Montpellier · 04 67 15 91 67 · secretariat@cgt34.fr | [CGT Hérault](https://herault.cgt.fr/la-cgt-pres-de-chez-vous) |
| Union locale CGT de Montpellier | même adresse · 04 67 15 91 70 · ul.montpellier@cgtmontpellier.com | [CGT Hérault](https://herault.cgt.fr/la-cgt-pres-de-chez-vous) |
| Code du travail numérique (modèle officiel « Demande de paiement de salaire ») | en ligne | [code.travail.gouv.fr](https://code.travail.gouv.fr/modeles-de-courriers/demande-de-paiement-de-salaire) |

**INCONNU :** les autres syndicats (CFDT, FO, CFTC, CFE-CGC, Solidaires…) n'ont pas été vérifiés pour Montpellier. Ils ne figurent donc pas dans la liste, ce qui n'est pas une recommandation pour un syndicat plutôt qu'un autre.

## 6. Formules exactes codées (`app/js/calc.js`) — partie intérim / temps plein

```
minutes de la semaine (lundi→dimanche, Paris), dans l'ordre chronologique :
  0 → 35 h        : normales            × taux
  35 h → 43 h     : heures sup tranche 1 × taux × (1 + 25 %)   [modifiable]
  au-delà de 43 h : heures sup tranche 2 × taux × (1 + 50 %)   [modifiable]
brut   = normales + HS1 + HS2 + primes « dans la base »
IFM    = arrondi(10 % × brut)            (0 si motif d'exclusion)
ICCP   = arrondi(10 % × (brut + IFM))
total  = brut + IFM + ICCP + primes « hors base »
écart  = attendu − bulletin, ligne par ligne (seules les lignes que vous avez remplies sont comparées)
« L'agence vous doit X € » si l'écart total ≥ 1 € ; sinon « Tout est en ordre ».
```
Arrondi au centime ligne par ligne. Un intervalle de travail qui passe minuit compte pour le jour où il commence (limite connue).

Temps partiel (H = heures par semaine au contrat, H < 35) : [0, H) normales · [H, H + H/10) +10 % · [H + H/10, 35 h) +25 % · puis heures sup comme ci-dessus.
Salaire mensuel : base = mensuel × nombre de mois de la période ; les minutes jusqu'à H dans la semaine sont couvertes par le mensuel ; les autres sont payées selon leur tranche, au taux horaire déduit.
Indemnité de fin : intérim → IFM ; CDD → précarité ; CDI → aucune. Elle est due si le motif de fin le permet. Elle est comptée sur la période si le contrat se termine dans le mois **ou si le bulletin saisi en verse déjà une** (versement chaque mois).
