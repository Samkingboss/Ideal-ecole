# IDEAL — instructions de travail

École Internationale Bilingue IDEAL, Faladié Sema, Bamako. Plateforme de gestion
scolaire. React 19 + Vite 8 (JSX, pas de TypeScript) + Supabase. Portail par rôle
dans `src/pages/`, plus cinq pages statiques autonomes dans `public/` qui attaquent
PostgREST en REST brut. Déploiement Vercel au push sur `main`. Rentrée 2026-2027.

## La contrainte qui structure tout

**Je n'ai que la clé anonyme.** Pas de `service_role`, pas de CLI Supabase, pas de
chaîne de connexion. Le DDL m'est impossible et le catalogue (`pg_proc`,
`information_schema`) m'est fermé en lecture depuis PostgREST.

Conséquence : **tout SQL passe par le directeur**, dans l'éditeur Supabase. Voir
le skill `migration-sql` pour le protocole et le format de passation.

## Quand interrompre le directeur

Quatre motifs, et rien d'autre :

1. une décision métier que ni le V2.1 ni `decisions.md` ne tranchent ;
2. une opération irréversible ou destructive ;
3. un accès ou un secret que je n'ai pas ;
4. un risque critique inattendu.

Tout le reste — contrôles techniques, tests, diagnostics, corrections réversibles,
déploiements dont les gardes sont au vert — se fait sans le solliciter.

## La boucle de travail

```
ANALYSER → IMPLÉMENTER → TESTER → DIAGNOSTIQUER → CORRIGER → RETESTER
         → NON-RÉGRESSION → répéter jusqu'aux critères de sortie → COMPLET
```

Limites d'oscillation et règles d'escalade : `docs/constitution/loops.md`.

## Ce qui fait autorité

| Rang | Source | Portée |
|---|---|---|
| 1 | `docs/constitution/IDEAL_Cahier_des_charges_V2.1.pdf` | Le cahier des charges. Prime sur tout. |
| 2 | `docs/constitution/decisions.md` | Décisions du promoteur là où le V2.1 laisse ouvert. |
| 3 | `docs/audits/` | Audits dérivés. Indice, jamais preuve. |
| 4 | Le code et la base | Décrit ce qui **est**, jamais ce qui **doit être**. |

**R13 du V2.1 :** aucune suggestion d'une IA ne devient une règle métier officielle
sans validation du promoteur. Une règle absente se signale, elle ne s'invente pas.
Le §23 liste quatorze décisions explicitement non formalisées : ne pas les combler.

Avant toute modification touchant les rôles, permissions, flux de données,
notifications, messagerie, dossiers élèves, RH, finances, vie scolaire, pédagogie,
cantine ou stocks — **lire la fiche du domaine** dans `docs/constitution/domaines.md`
et appliquer le skill `impact-metier`.

## Invariants durs

1. Aucun secret dans une table lisible par `anon`. Jamais de RPC qui révèle un code.
2. Une fiche alimentaire non validée s'affiche « NON VALIDÉE ». Jamais « Aucune ».
3. Jamais de fusion automatique de deux élèves. Le système signale, l'humain tranche.
4. Une signature enregistre l'autorité **et** le signataire réel, séparément.
5. Une erreur ne se rend jamais comme un vide. Chargement, erreur et vide sont trois états.
6. Ne jamais supprimer une table, fonction ou composant sans analyser ses dépendances (V2.1 §21).

Les points 2, 3 et 4 sont les décisions D1, D3 et D2. Le 6 est du V2.1.
Liste complète et traçable : `docs/constitution/invariants.md`.

## Gardes

```bash
./scripts/gardes.sh              # tout
./scripts/gardes.sh --statique   # < 3 s, sans réseau
./scripts/livrer.sh              # porte de complétion, avant tout commit de fin
```

Les gardes statiques tournent automatiquement en Hook après chaque édition.
La dette est tenue par cliquet dans `.ideal-etat.json` : les plafonds ne remontent
jamais, et baissent d'eux-mêmes quand la dette baisse. Ne jamais relever un plafond
à la main pour faire passer une garde — c'est le seul geste qui vide le dispositif
de son sens.

## Complétion

Une tâche n'est pas finie parce que le code est écrit. Elle est finie quand
`./scripts/livrer.sh` passe : comportement obtenu, gardes vertes, aucune régression,
aucun invariant rompu, workflow inter-rôles cohérent, build vert, risques subsistants
écrits.

## Discipline Git

Une branche par phase, `main` touchée au déploiement seulement. Un commit par unité
réversible, le message dit **pourquoi**. Quand un changement touche SQL et frontend,
le retour arrière se fait **SQL d'abord, frontend ensuite** — l'inverse laisse le code
face à un schéma absent. Le script d'annulation s'écrit avant la migration, pas après :
le forfait Supabase gratuit n'offre aucune restauration ponctuelle.

## Dette connue, phase 3

Les RPC `authentifier_par_code`, `enregistrer_utilisateur` et `desactiver_utilisateur`
sont accordées à `anon` et ne peuvent pas vérifier leur appelant. Le journal
l'enregistre honnêtement (`acteur non authentifié`) au lieu de prétendre le contraire.
La session `localStorage` reste falsifiable. Toutes les tables hors `inscriptions`,
`responsables`, `documents_inscription`, `users` et `journal_audit` restent ouvertes
en écriture à la clé anonyme.
