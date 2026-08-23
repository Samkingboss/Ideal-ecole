#!/usr/bin/env bash
# Porte de complétion — les sept critères, dans l'ordre.
# Une tâche n'est pas finie parce que le code est écrit.
cd "$(dirname "$0")/.." || exit 2
C_OK='\033[0;32m'; C_KO='\033[0;31m'; C_ATT='\033[0;33m'; C_GRIS='\033[0;90m'; C_FIN='\033[0m'
ECHECS=0

printf "\n${C_GRIS}══ PORTE DE COMPLÉTION ══${C_FIN}\n\n"

printf "  ${C_GRIS}[2,3,4] gardes, régressions, invariants${C_FIN}\n"
if ./scripts/gardes.sh >/tmp/ideal-gardes.log 2>&1; then
  printf "  ${C_OK}✓${C_FIN} toutes les gardes au vert\n"
else
  printf "  ${C_KO}✗${C_FIN} gardes en échec :\n"
  grep -E '✗' /tmp/ideal-gardes.log | sed 's/^/      /'
  ECHECS=$((ECHECS+1))
fi

printf "\n  ${C_GRIS}[6] build${C_FIN}\n"
if npx vite build >/tmp/ideal-build.log 2>&1; then
  printf "  ${C_OK}✓${C_FIN} vite build\n"
else
  printf "  ${C_KO}✗${C_FIN} build en échec :\n"; tail -12 /tmp/ideal-build.log | sed 's/^/      /'
  ECHECS=$((ECHECS+1))
fi

printf "\n  ${C_GRIS}[1,5,7] ce qu'aucun script ne tranche${C_FIN}\n"
printf "  ${C_ATT}?${C_FIN} 1 · le comportement demandé fonctionne — vérifié au navigateur ?\n"
printf "  ${C_ATT}?${C_FIN} 5 · workflow inter-rôles cohérent — skill impact-metier appliqué ?\n"
printf "  ${C_ATT}?${C_FIN} 7 · risques subsistants écrits dans le commit ?\n"

printf "\n${C_GRIS}═════════════════════════${C_FIN}\n"
if [ "$ECHECS" -eq 0 ]; then
  printf "  ${C_OK}CRITÈRES AUTOMATIQUES SATISFAITS${C_FIN}\n"
  printf "  ${C_GRIS}Les trois points de jugement restent à confirmer.${C_FIN}\n\n"; exit 0
else
  printf "  ${C_KO}NON LIVRABLE — %s bloc(s) en échec${C_FIN}\n\n" "$ECHECS"; exit 1
fi
