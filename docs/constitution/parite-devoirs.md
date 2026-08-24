# Matrice de parité — fusion du module Devoirs

Établie le 24 août 2026. Inventaire de l'ancien module lu ligne à ligne
(`public/pedago-archive/`, 1 515 + 384 + 768 lignes), inventaire du module
intégré relevé dans `src/pages/ProfApp.jsx`, mesures faites en production.

**Rien n'a été supprimé, rien n'a été basculé.** Ce document précède l'action.

---

## Lecture de la matrice

`ANCIEN` = `public/pedago-archive/` · `INTÉGRÉ` = onglet Devoirs de `ProfApp`

**A** absorber depuis l'ancien · **G** garder de l'intégré · **U** union des deux
· **=** déjà équivalent · **✗** n'existe nulle part

---

## 1 · Cycle de vie du devoir

| Fonction | Ancien | Intégré | Écart | Action |
|---|---|---|---|---|
| Créer | oui | oui | — | **=** |
| **Modifier** | **non** — le crayon recharge le formulaire et un nouvel enregistrement crée une SECONDE ligne (`app.js:491`, aucun PATCH dans le fichier) | non | les deux manquent | **✗ → à créer** |
| Supprimer | oui, `confirm()` puis DELETE (`app.js:669`) | non | l'intégré ne sait pas supprimer | **A** |
| Dupliquer | involontairement, par l'effet ci-dessus | non | ce n'est pas une fonction, c'est un défaut | ne pas reproduire |
| Brouillon | non — un formulaire non enregistré est perdu au rechargement | non | — | **✗** |
| Statut | **aucun** — vérifié, zéro occurrence de `statut`/`status` | aucun | ni l'un ni l'autre | **✗** |

> **Le bouton « modifier » de l'ancien module ne modifie pas.** Il duplique.
> Une fusion qui reprendrait son comportement introduirait le défaut dans IDEAL.

## 2 · Champs du devoir

| Champ | Ancien | Intégré | Action |
|---|---|---|---|
| Matière | texte **libre**, aucune liste (`index.html:184`) | `<select>` alimenté par `affectations_matieres` | **G** — le libre produit « Maths » et « Mathématiques » |
| Classe | `<select>` limité aux affectations, présélection si une seule | classe courante de l'écran | **U** |
| Type de devoir | 3 valeurs (`Devoir de Maison`, `Évaluation`, `Composition`) | absent | **A** |
| Période 1–5 | oui | absent | **A** |
| Énoncé (`content`) | textarea | absent — seul l'objectif existe | **A** |
| Objectifs | textarea | oui (`description`) | **=** |
| Barème | textarea, **toujours imprimé** même vide | absent | **A** |
| Date de remise | facultative ; **vide → le jour même** | **obligatoire**, + boutons des prochains jours de classe | **G** |
| Titre | colonne existante, **jamais écrite** par aucun des deux | idem | ignorer |
| Enseignant | texte, pré-rempli, verrouillé pour un professeur | `user_id` | **G** |

## 3 · Destinataires

| Fonction | Ancien | Intégré | Action |
|---|---|---|---|
| Toute la classe | oui | oui | **=** |
| Certains élèves | cases à cocher, tout cocher / décocher, résumé vivant | cases à cocher | **A** (les deux boutons et le résumé) |
| Recherche dans la liste | non | non | **✗ → à créer** (demandé) |
| Groupes | **n'existe pas** | n'existe pas | ✗ |
| Exclusions | **n'existe pas** | n'existe pas | ✗ |
| Source des élèves | `eleves` (actifs) **+ `inscriptions`**, dédupliqués sur nom+classe | `eleves` seulement | **A** — en début d'année, `inscriptions` est la seule source des nouveaux |
| Périmètre | `prof_classes` pour un professeur, tout pour la direction | classe courante | **U** |
| Clé conservée | `el:<uuid>` ou `ins:<matricule>` **+ le nom figé** | `<uuid>` nu | **A** — le nom figé permet d'afficher un destinataire parti de l'école |
| Réconciliation PS/MS/GS | oui (`app.js:142`) — écrite après qu'une enseignante ait perdu toute sa classe | non | **A** |

## 4 · Pièces jointes

| Fonction | Ancien | Intégré | Action |
|---|---|---|---|
| Images multiples | oui, base64 → Storage, chemin `{classe}/{ts}_{NN}.{ext}` | oui, Storage direct | **=** |
| PDF | non — `accept="image/*"` | oui — `accept="image/*,.pdf"` | **G** |
| Stockage | `contenu.images` (URL) | colonne `fichiers` | **canonique = `fichiers`**, lecture des deux |
| Échec d'envoi | fait échouer tout l'enregistrement ; images déjà déposées **orphelines** | idem | à corriger |
| Nettoyage à la suppression | **aucun** — les fichiers restent publics | pas de suppression | dette |

## 5 · Documents et impression

| Fonction | Ancien | Intégré | Action |
|---|---|---|---|
| Aperçu A4 en direct | oui, recalculé à chaque frappe (**sauf le barème**) | non | **A** |
| Impression modèle vierge | oui | via `DevoirsDocument` | **=** |
| **Publipostage nominatif** | oui — un jeu complet par élève, nom en garde et en pied | oui | **=** |
| Refus d'imprimer sans nom | **oui** — refus sec si la classe a des élèves, `confirm()` détaillé si vide | non | **A** |
| Nom d'élève géant en pied | oui, 13 pt gras — « pour rendre une feuille égarée » | non | **A** |
| Cadre NOTE /20 + appréciation | oui | non | **A** |
| Barème toujours imprimé | oui, avec repli textuel | non | **A** |
| PDF | **non** — `html2pdf.js` chargé mais **jamais appelé** | non | ✗ |
| Moteur | maison, DOM + `window.print()` | `DocumentPrintStudio` canonique | **G** |

## 6 · Communication aux familles

| Fonction | Ancien | Intégré | Action |
|---|---|---|---|
| Carte image PNG | oui, 640 px × scale 3 = 1920 px | non | **A** |
| Sommaire visuel des pages | oui — le parent voit combien de feuilles arrivent | non | **A** |
| File d'envois nominatifs | oui — un message par enfant, ✅ de suivi, saut au premier non envoyé | non | **A** |
| Relais par le WhatsApp de l'école | oui | oui | **=** |
| Nom de fichier parlant | `devoir-{Élève}-{Matière}.png` | non | **A** |
| Échéance obligatoire pour envoyer | **oui** | — | **A** |

## 7 · Ce qui n'existe nulle part

Notifications en base · planification différée · rappels · relances · détection
de retard · note numérique · rendu élève · pagination · brouillon · statut.

> **« Planifier » n'existe dans aucun des deux modules.** L'ancien ne porte
> qu'une date de remise saisie à la main, sans contrôle ; l'intégré ajoute des
> boutons vers les prochains jours de classe. Il n'y a donc pas deux workflows
> concurrents à réconcilier : il n'y en a qu'un, et il est pauvre.

## 8 · Défauts de l'ancien à ne pas absorber

| Défaut | Preuve |
|---|---|
| Les archives chargent **tous les devoirs de l'école** | `app.js:33`, `select=*` sans filtre — un professeur d'une classe voit tout |
| Le bouton modifier duplique | aucun PATCH dans le fichier |
| `classe_id` à `null` si le nom ne correspond pas exactement | `app.js:62`, égalité stricte |
| Compteur d'impression faux | `app.js:569` compare en `===` au lieu de `memeClasse` |
| Le barème n'apparaît pas dans l'aperçu | `app.js:284` ne l'écoute pas |
| Valeurs injectées en HTML brut | noms, matières, objectifs sans échappement |
| `inscriptions` lue sans filtre de statut | `app.js:1494` |
| Réactiver `ideal_homeworks` **écraserait les 13 devoirs** | `app.js:1406`, commentaire explicite |

---

## Risques de migration

1. **Aucun risque de perte de données** — les deux écrivent dans `devoirs`.
   Vérifié : 14 lignes, relues sans perte par `src/lib/devoirs.js`.
2. **`user_id` absent sur 13 devoirs sur 14.** Ils ne portent qu'un nom en
   texte. Aucune attribution ne sera fabriquée.
3. **Deux encodages de destinataires.** Un devoir destiné à trois élèves ne
   doit jamais devenir un devoir de classe entière : la lecture teste `mode`
   avant `eleve_ids`, jamais l'inverse.
4. **Le préfixe `el:`** distingue un élève inscrit d'un candidat (`ins:`).
   Le retirer sans le retenir perdrait cette distinction.
5. **Aucun poids caché** — mesuré : `select('*')` sur `devoirs` = 16 191 octets,
   identique à la liste explicite. Le problème des 1,7 Mo était propre à
   `eleves.photo_url` ; il ne se rejoue pas ici.

## Format canonique proposé

Colonnes inchangées. `contenu` devient :

```jsonc
{
  "type": "Devoir de Maison",
  "periode": "1",
  "enonce": "…",
  "bareme": "…",
  "destinataire_mode": "classe" | "choix",
  "eleve_ids": ["<uuid>"]
}
```

`objectif` reste la colonne `description`. Les pièces jointes restent la colonne
`fichiers`. Aucune information n'est stockée à deux endroits.

Les clés historiques — `subject`, `grade`, `content`, `objectives`, `period`,
`images`, `teacher`, `destinataires`, `dueDate`, `date`, `id` — **ne sont plus
écrites** mais restent lues.

## Identité de l'auteur

| | Règle |
|---|---|
| 13 devoirs historiques | conserver `contenu.teacher` tel quel, **affiché comme attribution historique**. Aucune correspondance vers un compte. |
| Nouveaux devoirs | `user_id` obligatoire, depuis la session authentifiée. Jamais saisi. |
| Affichage | `identiteProfessionnelle` — nom + fonction contextualisée par la matière du devoir. |

## Plan de bascule

```
1  absorber les champs manquants        type · période · énoncé · barème
2  absorber les destinataires           deux sources · tout cocher · nom figé · PS/MS/GS
3  absorber la modification             elle n'existe nulle part — à créer
4  absorber la suppression
5  absorber les règles d'impression     refus sans nom · barème · cadre note
6  absorber la carte parents            file nominative · sommaire visuel
7  écrire au format canonique
8  prouver les 14 devoirs relus         format historique ET format intégré
9  mobile 375 / 390 / 430
10 gardes, auto-testées
11 basculer la navigation
12 vérifier en production
13 retirer la redirection                — et seulement alors
```

Les étapes 1 à 10 sont réversibles et ne demandent aucune décision.
L'étape 13 seule est irréversible.

---

## Portes 1, 2, 5 et 6 — preuves

### 1 · Documents — fonctions absorbées

`DevoirsDocument.jsx` lit désormais chaque ligne par `lireDevoir()` et non plus
par accès direct aux colonnes. Conséquence : un devoir historique dont
l'objectif dort dans `contenu.objectives` s'imprime comme un devoir récent.

Absorbé de l'ancien module, vérifié à l'écran (390 px, aperçu ouvert à froid) :

| Élément | État |
|---|---|
| Type et période en pastille | ✓ |
| Bloc énoncé | ✓ |
| Barème **toujours** imprimé, à défaut « Barème communiqué lors de la correction. » | ✓ |
| Cadre NOTE …… / 20 | ✓ |
| APPRÉCIATION DE L'ENSEIGNANT, deux lignes pointillées | ✓ |

Un seul moteur documentaire : `DocumentPrintStudio`, quatre appelants.
`html2pdf.js` n'a jamais été introduit dans le portail — il n'y a donc rien à
retirer, et rien n'a été gardé par inertie.

### 2 · Carte parents — audit de sa fonction réelle

| Question | Réponse mesurée |
|---|---|
| Quel contenu | La liste des devoirs qui visent *cet* élève : type · matière : objectif — date de remise, et le nombre de feuilles jointes |
| Pour quel destinataire | Le parent de l'élève, nommément |
| Quel canal | WhatsApp de **l'école** (`wa.me/22390190007`), jamais le numéro personnel de l'enseignante |
| Quelle donnée source | Les devoirs déjà chargés, filtrés par `viseEleve()` — aucune relecture, aucun élargissement |
| Coordonnées parents dupliquées ? | **Non.** Le lien passe par `lienWhatsAppEcole()` de `src/lib/ecole.js`. La carte ne détient ni ne réaffiche le numéro du parent. |
| Identité de l'autrice | `signatureLigne()` — « Ornella MOGADZI — Enseignant », forme épicène par défaut, jamais déduite du prénom |

### 5 · Responsive — quatre largeurs

L'aperçu est **ouvert à froid à chaque largeur** : mesuré, `resize_window`
change les métriques du navigateur de test sans émettre ni `resize` ni rappel
`ResizeObserver` (0 sur des compteurs bruts, passage 390 → 430 px). Une échelle
figée observée après redimensionnement est donc un artefact du harnais, pas un
défaut produit — redimensionner puis mesurer ne prouverait rien.

| Largeur | Feuille A4 rendue | Débordement | Contrôles hors écran |
|---|---|---|---|
| 375 px | — (liste, ciblage, modification) | non | aucun |
| 390 px | 366 px (échelle 0,461) | non | aucun |
| 430 px | 406 px (échelle 0,511) | non | aucun |
| 1280 px | 794 px (pleine taille, sans transformation) | non | aucun |

### 6 · Performance — aucun effet n'efface une liste fraîchement chargée

| Scénario | Résultat |
|---|---|
| Arrivée sur le module (CP1) | 12 devoirs, stables sur 4,2 s |
| Changement de classe CP1 → CP2 | 0 devoir, **et l'absence est annoncée** — CP2 n'en a réellement aucun |
| Retour CP2 → CP1 | 12 devoirs, stables sur 4,8 s |
| Aller-retour d'onglet puis retour | liste stable, aucun effacement tardif |
| Rechargement à froid | 12 devoirs |

### Constat de données à arbitrer par la direction

L'ancien module créait **un devoir par photo**, non un devoir portant plusieurs
feuilles. Sur les 14 lignes de production, 8 sont des pages d'un même travail :

- Mathematics, donné le 13/08/2026 — 3 lignes créées à 1 s d'intervalle, 1 photo chacune
- Sciences « Reconnaître les fruits des légumes », donné le 04/07/2026 — 3 lignes
- Sciences « Les compétences de comptage de 0 à 50 », donné le 04/07/2026 — 2 lignes

Les fichiers diffèrent d'une ligne à l'autre : ce sont bien les pages 1, 2, 3
du même devoir. Le parent reçoit donc aujourd'hui le même travail annoncé trois
fois. Le module intégré ne reproduit pas ce comportement — il range N feuilles
dans un seul devoir. **Fusionner l'historique est destructif : la décision
revient à la direction, elle n'a pas été prise ici.**

---

## Porte 7 — l'identité de l'auteur

### Historique : conservé, jamais reconstitué

13 devoirs sur 14 n'ont pas de `user_id` : seulement `contenu.teacher`, un nom
en clair. Ces attributions restent telles quelles. `lireDevoir()` les expose
sous `auteurNomHistorique`, et la carte du devoir les affiche avec la mention
**« attribution historique »** — 11 mentions visibles sur l'écran CP1.

Aucune relation n'est fabriquée à partir d'un nom. La garde D14 l'exige de
façon exacte : `auteurId` ne peut venir que de `ligne.user_id`. Un premier
motif, plus vague, laissait passer `COMPTES.find(u => u.nom === c.teacher)` —
il ne savait pas échouer et a été remplacé.

### Nouveaux devoirs : auteur confirmé par le serveur

`auteurAuthentifie()` appelle `ideal_profil()`, qui lit `auth.uid()` dans le
jeton. Le `localStorage` n'intervient plus. Sans identité confirmée, rien n'est
enregistré.

| Test | Résultat |
|---|---|
| A · nouveau devoir | `user_id` présent, `origine = portail` |
| B · modification | même `user_id`, jamais réécrit — `user_id` est hors du corps commun et n'est posé qu'à l'`insert` |
| C · duplication | **non applicable** : le module n'offre pas de duplication. Si elle est ajoutée, l'auteur devra être celui qui duplique |
| D · devoir historique | lisible sans `user_id`, attribution textuelle affichée |
| E · aucune attribution arbitraire | garde D14, auto-testée sur deux défauts |

Vérifié à l'écran : sans session Auth confirmée, l'enregistrement est refusé et
la raison est dite — « Enregistrement refusé : aucune session IDEAL active :
reconnectez-vous avant d'enregistrer un devoir ». La base est restée à 14
lignes.

**Ce qui reste à vérifier en production** : le cas positif — une enseignante
réellement connectée obtient son `user_id`. Le mécanisme est celui que la page
de connexion emploie déjà (`ideal_profil()` juste après `signInWithPassword`),
mais je ne l'ai pas exercé de bout en bout faute de session réelle.

## Historique multi-pages — restitution, pas migration

L'ancienne plateforme créait une ligne par photo. Les 14 lignes restent
intactes : aucune fusion, aucun identifiant réuni, aucune suppression.

`regrouperPages()` ne regroupe qu'à l'affichage, et seulement si **tous** les
critères sûrs coïncident : origine historique, matière, objectif non vide,
date donnée, date de remise, type, mode de destinataire, liste d'élèves ciblés,
liste de matricules candidats. Dans le doute, affichage séparé.

Résultat sur les données réelles : **14 lignes → 9 cartes**, 14 identifiants
conservés, 0 ligne perdue. Les trois ensembles connus se regroupent en 3, 3 et
2 pages. Le message au parent passe de 11 annonces à 6.

Défaut trouvé et corrigé au passage : chaque pièce jointe historique vit à la
fois dans `fichiers` et dans `contenu.images`. Elle était comptée deux fois —
un devoir de deux pages en annonçait quatre. Dédoublonnage sur l'URL (D17).

## Grille de bascule — 15 critères

| # | Critère | Résultat | Preuve |
|---|---|---|---|
| 1 | 14 devoirs historiques relus sans perte | **PASS** | 14 lignes, 17 pièces distinctes, 0 perte sur id/matière/objectif/remise/barème/énoncé/auteur/pièces |
| 2 | Ciblages réels préservés | **PASS** | 11 désignations d'élèves relues, 0 écart de mode ni de liste |
| 3 | Candidats `ins:` préservés | **PASS** | 4/4 matricules candidats |
| 4 | Nouveaux devoirs au format canonique | **PASS** | fixture `71131f73` : type/période/énoncé/barème canoniques, aucune clé historique, `origine = portail` |
| 5 | Auteur Auth obligatoire | **PASS** | refus live sans session, base inchangée à 14 ; gardes D12/D13. Cas positif à confirmer en production |
| 6 | Modification = UPDATE du même id | **PASS** | même id, total inchangé, auteur et `date_donne` intacts, 3 pièces conservées, 3 champs mis à jour |
| 7 | Aucune duplication silencieuse | **PASS** | 14 lignes, 14 identifiants distincts |
| 8 | Suppression sûre | **PASS** | 204, retour à 14 lignes, empreinte des voisins `02d7f54a9f666515` identique avant/après |
| 9 | Plusieurs pièces sur un seul devoir | **PASS** | 1 ligne créée, 3 feuilles sur le même id |
| 10 | Documents / aperçu | **PASS** | feuille 351 / 366 / 406 / 794 px, aucun débordement |
| 11 | Carte parents | **PASS** | 3 destinataires, 6 lignes groupées, WhatsApp de l'école |
| 12 | Mobile 375 / 390 / 430 | **PASS** | aucun débordement, aucun contrôle hors écran aux trois largeurs |
| 13 | Desktop | **PASS** | 1280 px, A4 pleine taille |
| 14 | Performance | **PASS** | arrivée 12 stable, CP2 → 0 annoncé, retour 12 stable |
| 15 | Gardes complètes vertes | **PASS sur le périmètre devoirs · FAIL sur la suite** | D1–D18 vertes, toutes auto-testées. C1/C8 restent rouges sur `fiche.html` — antérieures, sans lien avec les devoirs, et non fermables sans une nouvelle surface SQL |

**Bascule effectuée** sur ce constat : les quatorze critères propres au module
sont PASS, et le quinzième n'échoue que sur deux gardes antérieures qui ne sont
pas une dépendance de ce basculement.

## Retour arrière

`public/pedago-archive/` **reste en ligne et intacte** — 4 entrées, `index.html`
et `app.js` compris. Seul le lien de navigation a été retiré. Rétablir la
bascule tient au rétablissement d'un bloc dans `src/pages/ProfApp.jsx`. La
garde D18 vérifie les deux faces : plus aucun lien, et le filet toujours là.

Le retrait physique n'aura lieu qu'après une période de preuve en production.
