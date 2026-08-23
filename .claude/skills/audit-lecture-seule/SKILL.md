---
name: audit-lecture-seule
description: Sonder la base de production sans rien écrire — codes PostgREST, pièges d'interprétation, méthode de vérification. À utiliser pour tout audit, contrôle post-migration ou diagnostic sur Supabase.
---

# Audit en lecture seule

## La règle qui prime

**Ne jamais présumer qu'une écriture échouera.** J'ai créé une ligne dans `users`
en production en supposant qu'une contrainte la rejetterait. Elle ne l'a pas
rejetée : PostgREST a renvoyé `201` avec un corps vide, que mon script a lu comme
une erreur.

Une sonde d'écriture n'est acceptable que si une preuve **antérieure** établit
qu'elle est rejetée avant toute écriture — un test transactionnel annulé, par
exemple. Sinon : ne pas la lancer.

## Lire les codes

| Code | Signification | Piège |
|---|---|---|
| `400` | Colonne inexistante | Se confond avec une erreur de syntaxe |
| `401` + `42501` | Droit refusé — la cible **existe** | Ce n'est pas une absence |
| `404` + `PGRST202` | Fonction absente **ou** signature différente | Ne prouve pas l'absence |
| `404` + `PGRST106` | Schéma non exposé | Confinement confirmé |
| `23503` | Clé étrangère violée → **RLS a laissé passer** | L'écriture était autorisée |
| `23502` | NOT NULL violé → **RLS a laissé passer** | Idem |
| `42501` sur INSERT | RLS a bloqué | La bonne réponse |
| `204` sur PATCH vide | Trompeur — toujours envoyer une vraie colonne | |
| `201` corps vide | **Une ligne a été créée** | Le piège de l'incident |

## Techniques sûres

**Vérifier une colonne** : `GET table?select=colonne&limit=1` → 200 ou 400.

**Vérifier l'existence d'une fonction sans l'exécuter** : envoyer un nom de
paramètre inexistant → `PGRST202`. Mais attention, ce code ne distingue pas
« mauvaise signature » de « fonction absente ». Pour trancher, passer par le
catalogue — donc par le directeur.

**La spécification OpenAPI (`GET /rest/v1/`) renvoie 401 pour `anon`.** Elle ne sert
à rien ici, et un `paths` vide n'est pas une preuve d'absence.

**Compter sans charger** : `-I` avec `Prefer: count=exact`, lire `content-range`.

## Pièges d'interprétation vécus

**Compter les clés d'un message d'erreur.** `len(json)` sur `{"code","details","hint","message"}`
renvoie 4 — lu comme « 4 dépendances ». Toujours vérifier qu'une réponse est bien
une liste avant de la compter.

**Le CDN sert un objet supprimé.** Un `200` sur une URL Storage ne prouve pas que
l'objet existe. Tester avec un paramètre anti-cache.

**Vercel oppose un « Security Checkpoint » à `curl`** — `403` sur les requêtes
automatisées. Passer par le navigateur intégré.

**Un hash de bundle qui diffère du build local ne prouve rien** : Vercel reconstruit
de son côté. Vérifier le **contenu** du bundle servi, pas son nom.

## Ce qu'on ne lit jamais

Aucun code d'accès, aucune valeur sensible, même pour vérifier. Contrôler la
**forme** — longueur, jeu de caractères, unicité, fraîcheur — jamais la valeur.
