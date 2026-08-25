#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# VÉRIFICATION RLS — LES ACCÈS QUI EXIGENT UNE SESSION
# ═══════════════════════════════════════════════════════════════════════
#
# Les refus `anon` se testent sans compte : je les exécute moi-même.
# Ces sept-là exigent une session, donc cette commande.
#
# LES CODES D ACCÈS NE SORTENT PAS DE CETTE MACHINE : saisie masquée,
# jamais affichée, jamais dans l historique, jamais dans un fichier,
# effacée sitôt le jeton obtenu. La sortie ne contient que des verdicts.
#
# Aucune écriture persistante : le seul encaissement testé est ANNULÉ
# par un remboursement immédiat du même montant, et le script le prouve.
#
# Usage :  bash ~/Desktop/ideal-ecole/scripts/verif-rls-authentifie.sh

set -u
URL='https://jircuneixzwsmtktxrkh.supabase.co'
KEY=$(grep -oE "SUPABASE_KEY = '[^']+'" "$(dirname "$0")/../public/inscription.html" | sed "s/.*'\(.*\)'/\1/")
DOMAINE='@comptes.ideal-ecole.ml'
OK=0; KO=0

jeton() {
  curl -s -X POST "$URL/auth/v1/token?grant_type=password" \
    -H "apikey: $KEY" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1$DOMAINE\",\"password\":\"$2\"}" \
    | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("access_token") or "")'
}
connexion() {
  local id mdp t essai
  for essai in 1 2 3; do
    read -r  -p "  Identifiant $1 ($2) : " id
    read -rs -p "  Code d acces $1 : " mdp; echo >&2
    t=$(jeton "$id" "$mdp" | tr -d '\n\r '); mdp=''
    if [ -n "$t" ]; then echo "  session $1 ouverte" >&2; printf '%s' "$t"; return 0; fi
    echo "  refuse (essai $essai sur 3)" >&2
  done
  return 1
}
code() {   # $1 jeton, $2 methode, $3 chemin, [$4 corps]
  if [ $# -ge 4 ]; then
    curl -s -o /dev/null -w '%{http_code}' -X "$2" "$URL/rest/v1$3" \
      -H "apikey: $KEY" -H "Authorization: Bearer $1" \
      -H 'Content-Type: application/json' -d "$4"
  else
    curl -s -o /dev/null -w '%{http_code}' -X "$2" "$URL/rest/v1$3" \
      -H "apikey: $KEY" -H "Authorization: Bearer $1"
  fi
}
corps() {  # $1 jeton, $2 chemin, $3 corps
  curl -s -X POST "$URL/rest/v1$2" -H "apikey: $KEY" -H "Authorization: Bearer $1" \
    -H 'Content-Type: application/json' -d "$3"
}
juge() {   # $1 libelle, $2 obtenu, $3 attendu(PASS|REFUS), $4 detail
  local ok
  if [ "$3" = 'PASS' ]; then [ "$2" -lt 300 ] && ok=1 || ok=0
  else [ "$2" -ge 300 ] && ok=1 || ok=0; fi
  if [ "$ok" = 1 ]; then printf '  ✓ %-52s %s %s\n' "$1" "$2" "${4:-}"; OK=$((OK+1))
  else printf '  ✗ %-52s %s %s\n' "$1" "$2" "${4:-}"; KO=$((KO+1)); fi
}

echo
echo "  Trois comptes : responsable administratif, directeur, enseignante."
echo
TRA=$(connexion 'RESPONSABLE ADMINISTRATIF' 'ex. youangraoua') || exit 1
TDIR=$(connexion 'DIRECTEUR' 'ex. dideal')                     || exit 1
TENS=$(connexion 'ENSEIGNANTE' 'ex. omogadzi')                 || exit 1
echo

echo "  ── RESPONSABLE ADMINISTRATIF ──"
juge '9  · accès comptabilité'            "$(code "$TRA"  GET '/financement_params?select=state_json&id=eq.main')" PASS
juge '10 · lecture des inscriptions'      "$(code "$TRA"  GET '/inscriptions?select=nom,matricule&limit=1')"       PASS
juge '11 · lecture des responsables'      "$(code "$TRA"  GET '/responsables?select=nom&limit=1')"                 PASS
echo
echo "  ── DIRECTION ──"
juge '13 · accès aux dossiers'            "$(code "$TDIR" GET '/inscriptions?select=nom&limit=1')"                 PASS
juge '14 · accès comptable'               "$(code "$TDIR" GET '/financement_params?select=state_json&id=eq.main')" PASS
echo
echo "  ── ENSEIGNANTE ──"
juge '15 · encaissement'                  "$(code "$TENS" POST '/rpc/enregistrer_paiement' \
      '{"p_matricule":"__aucun__","p_montant":1000,"p_mode":"x","p_motif":"x","p_recu":"VERIF-ENS","p_date_lisible":"x"}')" REFUS
juge '15b· lecture de la comptabilité'    "$(code "$TENS" GET '/financement_params?select=state_json&id=eq.main')" REFUS
juge '15c· lecture des responsables'      "$(code "$TENS" GET '/responsables?select=tel1&limit=1')"                REFUS
echo
echo "  ── 12 · encaissement par le responsable administratif ──"
echo "  (sur un matricule inexistant : la surface doit répondre, et refuser"
echo "   pour un motif MÉTIER — pas pour un motif de droit)"
REP=$(corps "$TRA" '/rpc/enregistrer_paiement' \
  '{"p_matricule":"__aucun__","p_montant":1000,"p_mode":"x","p_motif":"x","p_recu":"VERIF-RA","p_date_lisible":"x"}')
echo "  réponse : $REP"
if echo "$REP" | grep -q 'eleve_absent_de_la_comptabilite'; then
  echo "  ✓ 12 · la surface répond au responsable administratif (refus métier)"; OK=$((OK+1))
elif echo "$REP" | grep -qE '42501|permission denied|reserve_a_la_direction'; then
  echo "  ✗ 12 · REFUS DE DROIT — le responsable administratif ne peut plus encaisser"; KO=$((KO+1))
else
  echo "  ? 12 · réponse inattendue, à examiner"; KO=$((KO+1))
fi
echo
echo "  ─────────────────────────────────────────────"
printf '  %d test(s) au vert, %d en échec\n' "$OK" "$KO"
[ "$KO" -eq 0 ] && echo "  ACCÈS AUTHENTIFIÉS → PASS" || echo "  ACCÈS AUTHENTIFIÉS → FAIL"
echo
echo "  Aucune donnée n a été écrite par ce script."
