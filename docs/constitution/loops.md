# Boucles de travail, limites et escalade

## La boucle

```
ANALYSER → IMPLÉMENTER → TESTER → DIAGNOSTIQUER → CORRIGER → RETESTER
         → NON-RÉGRESSION → répéter jusqu'aux critères → COMPLET
```

Sans limite, une boucle oscille : elle corrige A, casse B, corrige B, recasse A.
Les limites ci-dessous ne sont pas des garde-fous de confort — elles évitent de
brûler une session sur une hypothèse fausse.

## Boucle de correction

```
implémenter → ./scripts/gardes.sh → si rouge : diagnostiquer → corriger → relancer
```

**Limite : 3 itérations par *signature d'échec*** — la garde en cause plus son
message, pas le nombre total de tours. Trois échecs différents corrigés d'affilée
ne comptent pas comme trois itérations.

**Escalade** quand la même signature revient une 3ᵉ fois, ou quand une correction
fait rougir deux fois de suite une garde jusque-là verte. Une oscillation signale
presque toujours une hypothèse fausse, pas un bug à écraser.

**Avant d'écraser, envisager que la garde ait tort.** Deux attendus se sont déjà
révélés faux plutôt que le système : `401` attendu `404` sur une fonction conservée
volontairement, et un seuil figé là où la propriété à tenir était une monotonie.

## Boucle de vérification production

```
./scripts/gardes/reseau.sh → si écart : diagnostiquer
                           → réversible : corriger  |  sinon : escalader
```

Avant chaque déploiement, et à la demande. **Limite : 2 tentatives.** Un écart en
production non résolu du premier coup relève du motif d'escalade n° 4.

## Boucle de phase

```
tant que les critères de sortie ne sont pas verts :
    tâche suivante → boucle de correction → ./scripts/livrer.sh
```

**Limite : 2 tâches consécutives bloquées** → arrêt et point avec le directeur.

## Arrêt immédiat, sans compter les tours

- Une garde de sécurité reste rouge après correction
- Un invariant issu d'une décision du promoteur est enfreint
- Une opération destructive ou irréversible devient nécessaire
- Deux corrections successives se contredisent
- Une règle métier manque et le V2.1 la déclare ouverte (**R13**)

## Les quatre motifs d'escalade

1. Décision métier que ni le V2.1 ni `decisions.md` ne tranchent
2. Opération irréversible ou destructive
3. Accès ou secret dont je ne dispose pas — **notamment tout SQL**
4. Risque critique inattendu

Tout le reste s'exécute sans solliciter le directeur.

## Ce qui tourne où

| Contrôle | Durée | Emplacement |
|---|---|---|
| `gardes.sh --statique` | < 3 s | **Hook** `PostToolUse` |
| `gardes/invariants.sh` | < 3 s | Boucle de correction |
| `gardes/reseau.sh` | ~10 s | Boucle production, avant déploiement |
| `vite build` | ~80 s | `livrer.sh` — jamais en hook |
| `eslint .` | ~90 s | cliquet dans `cliquets.sh` — jamais bloquant |

Un hook doit être rapide, fiable et actionnable. `vite build` et `eslint` n'y ont
pas leur place : le premier par sa durée, le second parce qu'il est rouge en
permanence et serait ignoré au bout de deux jours.
