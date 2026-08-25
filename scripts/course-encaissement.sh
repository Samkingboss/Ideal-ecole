#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# TEST DE CONCURRENCE RÉELLE — DEUX ENCAISSEMENTS SIMULTANÉS
# ═══════════════════════════════════════════════════════════════════════
#
# Deux requêtes HTTP lancées en parallèle : deux connexions distinctes,
# deux transactions PostgreSQL réellement concurrentes. Ce n'est pas un
# test séquentiel déguisé.
#
# LES CODES D'ACCÈS NE SORTENT PAS DE CETTE MACHINE.
#   · saisie masquée (`read -s`), jamais affichée ;
#   · jamais écrite dans l'historique du shell ;
#   · jamais enregistrée dans un fichier ;
#   · jamais transmise ailleurs qu'à l'authentification Supabase ;
#   · les jetons obtenus vivent en mémoire le temps du test.
#
# La sortie ne contient que le verdict et des montants.
#
# Usage :  bash ~/Desktop/ideal-ecole/scripts/course-encaissement.sh

set -u
URL='https://jircuneixzwsmtktxrkh.supabase.co'
KEY=$(grep -oE "SUPABASE_KEY = '[^']+'" "$(dirname "$0")/../public/inscription.html" | sed "s/.*'\(.*\)'/\1/")
MAT='26-27 A008'
DOMAINE='@comptes.ideal-ecole.ml'

echo
echo "  Deux comptes de la DIRECTION sont nécessaires."
echo "  (directeur ou responsable administratif — un enseignant sera refusé)"
echo
read -r  -p "  Identifiant A (ex. youangraoua) : " IDA
read -rs -p "  Code d'accès A : " MDPA; echo
read -r  -p "  Identifiant B (ex. dideal) : " IDB
read -rs -p "  Code d'accès B : " MDPB; echo
echo

jeton() {
  curl -s -X POST "$URL/auth/v1/token?grant_type=password" \
    -H "apikey: $KEY" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1$DOMAINE\",\"password\":\"$2\"}" \
    | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("access_token") or "")'
}

TA=$(jeton "$IDA" "$MDPA"); MDPA=''
TB=$(jeton "$IDB" "$MDPB"); MDPB=''

[ -z "$TA" ] && { echo "  ✗ Connexion A refusée. Vérifiez l'identifiant et le code."; exit 1; }
[ -z "$TB" ] && { echo "  ✗ Connexion B refusée. Vérifiez l'identifiant et le code."; exit 1; }
echo "  Deux sessions ouvertes."

etat() {
  curl -s "$URL/rest/v1/financement_params?select=state_json&id=eq.main" \
    -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H 'Cache-Control: no-cache' \
  | MAT="$MAT" python3 -c '
import sys, json, os
sj = json.load(sys.stdin)[0]["state_json"]
e = next((s for s in sj.get("students", []) if s.get("matricule") == os.environ["MAT"]), None)
if not e: print(json.dumps({"absent": True})); raise SystemExit
h = e.get("history", [])
print(json.dumps({"paye": e.get("paye"), "n": len(h),
                  "recus": [x.get("receiptId") for x in h],
                  "auteurs": sorted({x.get("par_nom") for x in h if x.get("par_nom")}),
                  "instants": [x.get("le") for x in h]}))'
}

AVANT=$(etat)
echo "  Avant : $AVANT"
echo

STAMP=$(date +%s)
appel() {   # $1 jeton, $2 montant, $3 mode, $4 suffixe de reçu
  curl -s -X POST "$URL/rest/v1/rpc/enregistrer_paiement" \
    -H "apikey: $KEY" -H "Authorization: Bearer $1" -H 'Content-Type: application/json' \
    -d "{\"p_matricule\":\"$MAT\",\"p_montant\":$2,\"p_mode\":\"$3\",
         \"p_motif\":\"Régularisation Globale\",
         \"p_recu\":\"COURSE-$STAMP-$4\",\"p_date_lisible\":\"course $STAMP\"}"
}

# ── LES DEUX EN MÊME TEMPS ────────────────────────────────────────────
appel "$TA" 30000 'Espèces' A > /tmp/course-A.json &
PA=$!
appel "$TB" 50000 'Wave'    B > /tmp/course-B.json &
PB=$!
wait $PA; wait $PB

echo "  Réponse A : $(cat /tmp/course-A.json)"
echo "  Réponse B : $(cat /tmp/course-B.json)"
echo
sleep 1
APRES=$(etat)
echo "  Après : $APRES"
echo

AVANT="$AVANT" APRES="$APRES" python3 <<'PY'
import json, os
a = json.loads(os.environ["AVANT"]); b = json.loads(os.environ["APRES"])
if a.get("absent") or b.get("absent"):
    print("  ✗ FAIL — l'élève 26-27 A008 est absent de la comptabilité."); raise SystemExit
ajout   = (b["paye"] or 0) - (a["paye"] or 0)
nouveaux = [r for r in b["recus"] if r not in a["recus"]]
crit = [
  ("total ajouté = 80 000",        ajout == 80000, f"{ajout}"),
  ("2 opérations de plus",         b["n"] - a["n"] == 2, f'{a["n"]} → {b["n"]}'),
  ("2 références distinctes",      len(set(nouveaux)) == 2, ", ".join(nouveaux)),
  ("2 auteurs identifiables",      len(b["auteurs"]) >= 2, ", ".join(b["auteurs"])),
  ("horodatages distincts",        len(set(b["instants"])) == b["n"], f'{len(set(b["instants"]))}/{b["n"]}'),
]
for nom, ok, det in crit:
    print(f'  {"✓" if ok else "✗"} {nom:<28} {det}')
print()
print("  CONCURRENCE →", "PASS" if all(ok for _, ok, _ in crit) else "FAIL")
PY
rm -f /tmp/course-A.json /tmp/course-B.json
