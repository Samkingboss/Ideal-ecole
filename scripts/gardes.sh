#!/usr/bin/env bash
# Orchestrateur des gardes IDEAL.
#
#   ./scripts/gardes.sh              tout
#   ./scripts/gardes.sh --statique   < 3 s, sans réseau — usage Hook
#   ./scripts/gardes.sh --metier     invariants métier seulement
#
# Sortie 0 si tout passe, 1 sinon.
cd "$(dirname "$0")/.." || exit 2
D=scripts/gardes
ECHECS=0

lance() { "$D/$1" || ECHECS=$((ECHECS+1)); }

case "${1:-}" in
  --statique) lance statiques.sh; lance ecrans.sh; lance cliquets.sh ;;
  --metier)   lance invariants.sh ;;
  *)          lance statiques.sh; lance ecrans.sh; lance cliquets.sh
              lance invariants.sh; lance reseau.sh ;;
esac

printf '\033[0;90m═══════════════════════════════════════════════════════\033[0m\n'
if [ "$ECHECS" -eq 0 ]; then
  printf '  \033[0;32mTOUS LES MODULES AU VERT\033[0m\n\n'; exit 0
else
  printf '  \033[0;31m%s MODULE(S) EN ÉCHEC\033[0m\n\n' "$ECHECS"; exit 1
fi
