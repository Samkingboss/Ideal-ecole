---
name: livraison
description: Critères de complétion d'une tâche IDEAL. À appliquer avant tout commit de fin de tâche ou déploiement. Adossé à scripts/livrer.sh.
---

# Livraison

## La règle

**Une tâche n'est pas finie parce que le code est écrit.** `MaternelleApp` a été
considéré livré alors qu'il n'était monté nulle part — il ne l'est toujours pas.

## Les sept critères

```bash
./scripts/livrer.sh
```

| # | Critère | Vérifié par |
|---|---|---|
| 1 | Le comportement demandé fonctionne | Test, ou vérification navigateur |
| 2 | Les gardes concernées passent | `gardes.sh` |
| 3 | Aucune régression nouvelle | cliquets + `ecrans.sh` |
| 4 | Aucun invariant de sécurité rompu | `invariants.sh` + `reseau.sh` |
| 5 | Le workflow inter-rôles reste cohérent | skill `impact-metier` — **jugement** |
| 6 | Le build passe | `vite build` |
| 7 | Les risques subsistants sont écrits | section du message de commit |

Le critère 5 ne s'automatise pas. `livrer.sh` le rappelle sans pouvoir le trancher.

## Vérifier le comportement, pas le code

Pour tout ce qui est visible : passer par le navigateur intégré, pas par une
relecture du diff. Contrôler la console, le réseau, l'état après rechargement.

Vérifier le **contenu** du bundle servi, pas son nom — le hash diffère toujours
entre le build local et celui de Vercel.

## Écrire la dette

Une dette écrite est une dette qu'on peut solder ; une dette tue disparaît puis
resurgit. Chaque commit de fin de tâche porte ce qui reste ouvert, et pourquoi.

## Ne jamais relever un plafond pour faire passer une garde

C'est le seul geste qui vide le dispositif de son sens. Un plafond dépassé signifie
que la dette a augmenté : soit on corrige, soit on l'assume explicitement auprès du
directeur. Jamais en silence.
