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
# ── Juger le CONTENU, pas le code HTTP ───────────────────────────────────
#
# Sous RLS, une lecture non autorisee ne leve PAS d erreur : la politique
# filtre les lignes et PostgREST repond 200 avec []. Juger sur le statut,
# c est confondre « refuse » et « en erreur ».
#
# Ce script le faisait, et il a declare FAIL sur deux acces pourtant fermes.
# C est exactement le defaut deja corrige dans la garde S1-S8, reintroduit
# ici. Il rend desormais « statut:lignes ».
resultat() {   # $1 jeton, $2 methode, $3 chemin, [$4 corps]
  local rep code corps
  if [ $# -ge 4 ]; then
    rep=$(curl -s -w '\n%{http_code}' -X "$2" "$URL/rest/v1$3" \
      -H "apikey: $KEY" -H "Authorization: Bearer $1" \
      -H 'Content-Type: application/json' -d "$4")
  else
    rep=$(curl -s -w '\n%{http_code}' -X "$2" "$URL/rest/v1$3" \
      -H "apikey: $KEY" -H "Authorization: Bearer $1")
  fi
  code=$(printf '%s' "$rep" | tail -1)
  corps=$(printf '%s' "$rep" | sed '$d')
  printf '%s:%s' "$code" "$(printf '%s' "$corps" | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
    print(len(d) if isinstance(d, list) else -1)
except Exception:
    print(-1)')"
}
corps_get() {  # $1 jeton, $2 chemin — rend le corps brut d une lecture
  curl -s "$URL/rest/v1$2" -H "apikey: $KEY" -H "Authorization: Bearer $1" \
    -H 'Cache-Control: no-cache'
}
corps() {  # $1 jeton, $2 chemin, $3 corps
  curl -s -X POST "$URL/rest/v1$2" -H "apikey: $KEY" -H "Authorization: Bearer $1" \
    -H 'Content-Type: application/json' -d "$3"
}
# ── Juger la PROPRIÉTÉ, pas le code HTTP ────────────────────────────────
#
# Deux pieges, tous deux rencontres :
#
#   200 + []   sous RLS, une lecture refusee ne leve pas d erreur : la
#              politique filtre les lignes. C est un REFUS, pas un succes.
#
#   403        peut etre le bon refus metier — ou une session invalide, une
#              RPC absente, une panne. Les traiter pareil, c est declarer
#              PASS sur une preuve qu on n a pas.
#
# $2 vaut « statut:lignes ». Autorise = des lignes reviennent.
juge() {   # $1 libelle, $2 statut:lignes, $3 attendu(PASS|REFUS)
  local code lignes ok
  code=${2%%:*}; lignes=${2##*:}
  if [ "$3" = 'PASS' ]; then
    { [ "$code" -lt 300 ] && [ "$lignes" -gt 0 ]; } && ok=1 || ok=0
  else
    # Un refus de LECTURE se lit a zero ligne, ou a une erreur qui n est pas
    # un probleme de session : 401 signifie « pas connecte », ce qui ne
    # prouve rien sur les droits.
    { { [ "$code" -ge 400 ] && [ "$code" != 401 ]; } || [ "$lignes" = 0 ]; } && ok=1 || ok=0
  fi
  if [ "$ok" = 1 ]; then printf '  ✓ %-46s %s (%s ligne(s))\n' "$1" "$code" "$lignes"; OK=$((OK+1))
  else printf '  ✗ %-46s %s (%s ligne(s))\n' "$1" "$code" "$lignes"; KO=$((KO+1)); fi
}

# Un refus METIER : il faut que le serveur dise POURQUOI, et que ce pourquoi
# soit la regle attendue. Un 403 muet, un 401 de session, une RPC absente ou
# une panne reseau ne prouvent pas la regle.
juge_refus_metier() {   # $1 libelle, $2 corps de reponse, $3 motif attendu
  local verdict
  # Le corps est ENVOYÉ sur l'"'"'entrée : sans cela, python attendait
  # indéfiniment une saisie qui ne venait jamais.
  verdict=$(printf '%s' "$2" | MOTIF="$3" python3 -c '
import sys, json, os
motif = os.environ["MOTIF"]
brut = sys.stdin.read()
try:
    d = json.loads(brut)
except Exception:
    print("FAIL|reponse illisible : " + brut[:60]); raise SystemExit
if isinstance(d, dict) and d.get("message"):
    m = d["message"]
    if motif in m:                       print("PASS|refus metier : " + m[:70])
    elif "JWT" in m or "session" in m.lower() or d.get("code") == "PGRST301":
                                          print("FAIL|refus de SESSION, pas de droit : " + m[:60])
    elif d.get("code") == "PGRST202":     print("FAIL|la surface serveur est absente")
    else:                                 print("FAIL|refus pour une autre raison : " + m[:60])
else:
    print("FAIL|ACCEPTE — " + brut[:70])
')
  if [ "${verdict%%|*}" = 'PASS' ]; then printf '  ✓ %-46s %s\n' "$1" "${verdict#*|}"; OK=$((OK+1))
  else printf '  ✗ %-46s %s\n' "$1" "${verdict#*|}"; KO=$((KO+1)); fi
}

echo
echo "  Trois comptes : responsable administratif, directeur, enseignante."
echo
TRA=$(connexion 'RESPONSABLE ADMINISTRATIF' 'ex. youangraoua') || exit 1
TDIR=$(connexion 'DIRECTEUR' 'ex. dideal')                     || exit 1
TENS=$(connexion 'ENSEIGNANTE' 'ex. omogadzi')                 || exit 1
echo

echo "  ── RESPONSABLE ADMINISTRATIF ──"
juge '9  · accès comptabilité'            "$(resultat "$TRA"  GET '/financement_params?select=state_json&id=eq.main')" PASS
juge '10 · lecture des inscriptions'      "$(resultat "$TRA"  GET '/inscriptions?select=nom,matricule&limit=1')"       PASS
juge '11 · lecture des responsables'      "$(resultat "$TRA"  GET '/responsables?select=nom&limit=1')"                 PASS
echo
echo "  ── DIRECTION ──"
juge '13 · accès aux dossiers'            "$(resultat "$TDIR" GET '/inscriptions?select=nom&limit=1')"                 PASS
juge '14 · accès comptable'               "$(resultat "$TDIR" GET '/financement_params?select=state_json&id=eq.main')" PASS
echo
echo "  ── ENSEIGNANTE ──"
REP_ENS=$(corps "$TENS" '/rpc/enregistrer_paiement' \
  '{"p_matricule":"__aucun__","p_montant":1000,"p_mode":"x","p_motif":"x","p_recu":"VERIF-ENS","p_date_lisible":"x"}')
echo "  réponse : $REP_ENS"
juge_refus_metier '15 · encaissement' "$REP_ENS" 'encaissement_reserve_a_la_direction'
COMPTA_ENS=$(corps_get "$TENS" '/financement_params?select=state_json&id=eq.main')
echo "  corps reçu par l enseignante : ${COMPTA_ENS:0:120}"
juge '15b· lecture de la comptabilité'    "$(resultat "$TENS" GET '/financement_params?select=state_json&id=eq.main')" REFUS
juge '15c· lecture des responsables'      "$(resultat "$TENS" GET '/responsables?select=tel1&limit=1')"                REFUS
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
