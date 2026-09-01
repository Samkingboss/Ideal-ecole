# Fermeture de `app_state`

## L'état constaté

Mesuré depuis la clé publique — celle qui est dans le navigateur de tout
visiteur :

```
GET  /rest/v1/app_state?app=eq.notifications   → 200
POST /rest/v1/app_state                        → 201
```

`anon` lit et écrit `app_state`. L'écriture y est un **remplacement de liste**,
pas un ajout. Quiconque détient la clé peut donc forger une notification,
remplacer une boîte entière, ou la vider.

### Ce que le diagnostic a établi

| Mesure | Résultat |
|---|---|
| Privilèges de table | `anon`, `authenticated` et `service_role` ont **les mêmes** : DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| RLS | active (`rls_active = true`, non forcée) |
| Politiques | trois, **toutes `{anon}`** : `app_state_read` SELECT, `app_state_write` INSERT, `app_state_update` UPDATE |

Deux conséquences.

**Le levier de fermeture n'est pas le GRANT, c'est la politique.** Les trois
rôles ont les mêmes privilèges ; seules les politiques décident. Fermer
`app_state` à `anon` sera un retrait de `app_state_write` et
`app_state_update`, pas un `revoke`.

**Aucune politique ne couvre `DELETE`** — alors que les trois rôles en ont le
privilège. Sous RLS, une commande sans politique est refusée : la suppression
est donc déjà fermée à tout le monde. C'est le seul verrou en place, et il
tient par omission, non par intention.

La RPC `notifier_preparation` corrige un workflow. Elle ne ferme pas cette
porte.

## Pourquoi la fermeture ne peut pas être brutale

Dix-sept écritures directes en dépendent encore. Les fermer d'un coup casserait
la cantine, les demandes RH, la grille des postes, les dossiers du personnel et
le formulaire public d'inscription.

Une contrainte est structurante : **`public/inscription.html` écrit sans que
personne soit connecté**. Le parent d'un candidat est anonyme par construction.
Cette écriture ne peut pas devenir « réservée à `authenticated` » — elle doit
devenir une intention métier étroite, exécutable par `anon`, sans autre pouvoir
que celui de signaler une inscription précise.

## Le principe de remplacement

```
AVANT   ecrire_app_state('notifications', <ce que je veux>)
APRÈS   notifier_preparation(<de quoi je parle>)
```

Le navigateur n'écrit pas l'état. Il exprime une intention. Le serveur lit
`auth.uid()`, vérifie le droit, construit la donnée et l'écrit lui-même.

## Inventaire des 15 écritures restantes

| Écriture | Espace | Workflow métier | Qui a le droit | Ce qu'il peut réellement modifier | Surface de remplacement |
|---|---|---|---|---|---|
| `src/lib/notifications.js:77` | APP_NOTIFS | Toute notification du portail (10 appelants) | personnel connecte | la boite du destinataire, en ajout | `une RPC par intention metier ; `notifier_preparation` est la premiere` |
| `src/pages/ActivitePersonnel.jsx:251` | rh | Fiche d'activite du personnel | direction | les points et l'activite d'un agent | `enregistrer_activite_personnel` |
| `src/pages/CuisiniereApp.jsx:405` | (non précisé) | Pointage des repas du jour | cuisiniere | le pointage du jour, sa cantine | `pointer_repas — ECRITURE DEJA MORTE : `app` manque, la cle primaire la refuse` |
| `src/pages/CuisiniereApp.jsx:542` | cantine | Menu de la semaine | cuisiniere | le menu de sa cantine | `enregistrer_menu_semaine` |
| `src/pages/CuisiniereApp.jsx:564` | cantine | Menu de la semaine (validation) | cuisiniere | le menu de sa cantine | `enregistrer_menu_semaine` |
| `src/pages/CuisiniereApp.jsx:576` | cantine | Fiche de marche | cuisiniere | la fiche de marche courante | `enregistrer_fiche_marche` |
| `src/pages/CuisiniereApp.jsx:690` | cantine | Historique des justificatifs | cuisiniere | ses propres justificatifs, en ajout | `deposer_justificatif_cantine` |
| `src/pages/DemandesEnseignant.jsx:271` | (non précisé) | Depot d'une demande RH | enseignant | sa propre demande, en ajout a la file | `deposer_demande_rh` |
| `src/pages/DirecteurApp.jsx:190` | rh | Reponse de la direction a une demande RH | direction | le statut et la reponse d'une demande | `repondre_demande_rh` |
| `src/pages/DirecteurApp.jsx:491` | rh | Creation / modification d'un poste | direction | la grille des postes | `enregistrer_poste` |
| `src/pages/DirecteurApp.jsx:551` | rh | Suppression d'un poste | direction | la grille des postes | `supprimer_poste` |
| `src/pages/DirecteurApp.jsx:564` | rh | Parametres RH (points, saisie manuelle) | direction | la configuration RH | `enregistrer_parametres_rh` |
| `src/pages/DirecteurApp.jsx:940` | cantine | Fiche de marche cantine cote direction | direction | la fiche de marche courante | `enregistrer_fiche_marche` |
| `src/pages/DossierPersonnel.jsx:160` | (non précisé) | Dossier RH personnel | l'agent lui-meme | SON dossier, et lui seul | `enregistrer_mon_dossier_rh` |
| `public/comptabilite.html:7544` | rh | Grille des postes, page comptabilite | direction | la grille des postes | `enregistrer_poste` |
## Ordre de migration

Par risque décroissant, et par indépendance.

**1 · Notifications** — `notifier_preparation` est faite. Restent la surface
générique de `notifications.js` (10 appelants) et les deux écritures publiques
d'`inscription.html`. C'est le namespace le plus exposé : une notification
forgée porte la parole de la direction.

**2 · `rh`** — dossiers du personnel, demandes, postes, paramètres. Contient
des données nominatives d'employés. `dossier_rh_<id>` est le cas le plus net :
chacun ne doit écrire que le sien.

**3 · `cantine`** — menus, fiche de marché, justificatifs. Moins sensible.

## Quatre écritures qui mentaient — corrigées

Trouvées en auditant l'inventaire, sans rapport avec la fermeture elle-même,
mais toutes de la même famille : **le client Supabase ne lève pas d'exception,
il rend `{ error }`**. Un `try/catch` autour d'un `upsert` n'attrape donc rien.

| Écriture | Ce qui se passait | État |
|---|---|---|
| `CuisiniereApp.savePointage` | `app` omise → 400 · 23502 à chaque fois. **Zéro pointage n'a jamais été enregistré** — vérifié en base. La cuisinière cochait ses repas, l'écran les affichait, tout disparaissait au rechargement. Le `console.error` lui-même ne s'exécutait pas. | corrigée, l'échec est désormais dit |
| `CuisiniereApp.saveMenuSemaine` | « ✅ Menu de la semaine enregistré » s'affichait même sur un refus du serveur | corrigée |
| `DossierPersonnel` | `setSaved(true)` s'exécutait quoi qu'il arrive : l'employé lisait « enregistré » sans que rien ne parte | corrigée |
| `DirecteurApp` · budget du marché | le budget s'affichait modifié à l'écran sans avoir été enregistré | corrigée |

Une cinquième, le nettoyage cosmétique des postes au chargement, ignorait aussi
son résultat. Sans conséquence pour l'utilisateur — la tentative recommence au
chargement suivant — mais le résultat est désormais lu et journalisé : une
écriture dont personne ne regarde l'issue est une écriture dont personne ne
sait qu'elle échoue depuis des mois.

La garde A6 empêche le retour de cette famille.

## Porte de fermeture

Aucune révocation avant que les trois conditions soient réunies :

- aucun frontend ne fait INSERT/UPDATE/DELETE direct sur `app_state` ;
- aucune fonctionnalité légitime ne dépend du rôle `anon` pour écrire ;
- chaque RPC de remplacement a été testée, en cas autorisé **et** en cas
  interdit.

Alors seulement : révocation de l'écriture directe d'`anon`, puis reprise de
tous les workflows concernés.

## Gardes qui tiennent la ligne d'ici là

| Garde | Ce qu'elle empêche |
|---|---|
| A1 | Une dix-huitième écriture directe. Le plafond ne remonte jamais. |
| A2 | Un script SQL qui élargirait l'écriture d'`anon`. |
| A3 | Une surface métier qui retomberait sur l'écriture générique. |
| A4 | Un échec de notification qui annulerait une sauvegarde ou ouvrirait un droit. |
| A5 | Une écriture qui disparaîtrait de ce plan sans avoir été migrée. |

### Note sur la mesure

Le cliquet `app_state_ecritures` était à 13. Il comptait
`grep "from('app_state')" | grep -E 'insert|upsert'` **sur une seule ligne** :
quatre écritures dont le `.upsert(` tombait à la ligne suivante lui étaient
invisibles, et un simple retour à la ligne suffisait à passer dessous sans le
déclencher. Le compteur est désormais
`scripts/gardes/compter-ecritures-app-state.mjs`, qui lit la chaîne complète.

Le plafond est passé de 13 à 17. **La dette n'a pas augmenté — la mesure a
cessé d'être aveugle.** Il ne doit plus jamais remonter.
