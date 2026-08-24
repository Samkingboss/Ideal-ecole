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
# Les gardes écrites en JS sont lancées par Node : pas de shebang à maintenir,
# pas de bit exécutable à perdre au fil des copies.
lanceJS() { node "$D/$1" || ECHECS=$((ECHECS+1)); }

case "${1:-}" in
  --statique) lance statiques.sh; lance ecrans.sh; lance cliquets.sh
              lanceJS test-chargement.mjs; lanceJS test-programmes.mjs
              lanceJS test-identite.mjs; lanceJS test-responsive.mjs
              lanceJS test-reseau-client.mjs; lanceJS test-documents.mjs
              lanceJS test-confidentialite.mjs; lanceJS test-remarques.mjs; lanceJS test-devoirs.mjs ;;
  --metier)   lance invariants.sh ;;
  *)          lance statiques.sh; lance ecrans.sh; lance cliquets.sh
              lanceJS test-chargement.mjs; lanceJS test-programmes.mjs
              lanceJS test-identite.mjs; lanceJS test-responsive.mjs
              lanceJS test-reseau-client.mjs; lanceJS test-documents.mjs
              lanceJS test-confidentialite.mjs; lanceJS test-remarques.mjs
              lanceJS test-devoirs.mjs
              lance invariants.sh; lance reseau.sh ;;
esac

printf '\033[0;90m═══════════════════════════════════════════════════════\033[0m\n'
if [ "$ECHECS" -eq 0 ]; then
  printf '  \033[0;32mTOUS LES MODULES AU VERT\033[0m\n\n'; exit 0
else
  printf '  \033[0;31m%s MODULE(S) EN ÉCHEC\033[0m\n\n' "$ECHECS"; exit 1
fi
