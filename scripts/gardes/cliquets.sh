#!/usr/bin/env bash
# Dette technique tenue par cliquet.
#
# On ne corrige pas les 67 `data || []` d'un coup : on interdit le 68e. Exiger
# zéro bloquerait le projet ; tolérer sans limite laisserait la dette croître.
# Chaque baisse abaisse le plafond, définitivement.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$RACINE" || exit 2

titre "CLIQUETS · la dette ne remonte jamais"

# INV-UI-02 — une erreur rendue comme un vide. Cible d'une phase dédiée.
#
# La mesure comptait deux choses qui ne sont pas de la dette : le COMMENTAIRE
# de `src/lib/chargement.js` qui décrit précisément ce motif pour le proscrire,
# et quatre lignes de `ProgrammeManager.jsx.illisible`, fichier volontairement
# neutralisé que le build n'emporte pas. Une mesure qui compte sa propre
# documentation finit par se faire ignorer.
#
# On ne compte plus que du code réellement livré. Le plafond s'abaisse d'autant
# et ne remontera pas : rien n'est relâché, la mesure cesse d'être bruyante.
N=$(grep -rn 'data || \[\]' src/ public/ 2>/dev/null \
      | grep -v '\.illisible:' \
      | grep -vE ':[0-9]+: *(//|\*|/\*)' \
      | wc -l | tr -d ' ')
cliquet "data_ou_vide" "C1 · erreurs converties en liste vide  [INV-UI-02]" "$N"

# INV-FLUX-04 · V2.1 §8 — un point d'entrée unique, pas dix.
#
# Même correction de mesure : un commentaire qui explique le repli WhatsApp
# n'est pas un point d'appel. On compte les appels, pas les phrases.
N=$(grep -rn 'wa\.me' src/ public/ 2>/dev/null \
      | grep -vE ':[0-9]+: *(//|\*|/\*)' \
      | wc -l | tr -d ' ')
cliquet "wa_me_disperses" "C2 · points d'appel WhatsApp dispersés  [INV-FLUX-04]" "$N"

# Non bloquant pour le build, mais ne doit pas croître.
if command -v npx >/dev/null 2>&1; then
  N=$(npx eslint . 2>/dev/null | grep -cE '^\s+[0-9]+:[0-9]+' || echo 0)
  cliquet "eslint" "C3 · erreurs eslint" "$N"
fi

bilan
