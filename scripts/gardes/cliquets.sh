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
N=$(grep -rn 'data || \[\]' src/ public/ 2>/dev/null | wc -l | tr -d ' ')
cliquet "data_ou_vide" "C1 · erreurs converties en liste vide  [INV-UI-02]" "$N"

# INV-FLUX-04 · V2.1 §8 — un point d'entrée unique, pas dix.
N=$(grep -rn 'wa\.me' src/ public/ 2>/dev/null | wc -l | tr -d ' ')
cliquet "wa_me_disperses" "C2 · points d'appel WhatsApp dispersés  [INV-FLUX-04]" "$N"

# Non bloquant pour le build, mais ne doit pas croître.
if command -v npx >/dev/null 2>&1; then
  N=$(npx eslint . 2>/dev/null | grep -cE '^\s+[0-9]+:[0-9]+' || echo 0)
  cliquet "eslint" "C3 · erreurs eslint" "$N"
fi

# Le test de non-régression du dispositif à trois états. Il reproduit le bug
# « 0 élèves » et vérifie qu'il ne peut plus se produire.
printf "  %-54s " "C4 · test des trois états (chargement/erreur/vide)"
if node scripts/gardes/test-chargement.mjs >/dev/null 2>&1; then
  printf "${C_OK}✓${C_FIN}\n"; OK=$((OK+1))
else
  printf "${C_KO}✗ le test échoue${C_FIN}\n"; KO=$((KO+1))
  ALERTES+=("C4 : scripts/gardes/test-chargement.mjs échoue")
fi

bilan
