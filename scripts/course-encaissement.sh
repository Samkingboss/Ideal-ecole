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
jeton() {
  curl -s -X POST "$URL/auth/v1/token?grant_type=password" \
    -H "apikey: $KEY" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1$DOMAINE\",\"password\":\"$2\"}" \
    | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("access_token") or "")'
}

# Trois essais par compte, plutot que de tout reprendre pour une frappe.
# Le code est efface de la variable des le jeton obtenu.
connexion() {   # $1 = etiquette, $2 = exemple d identifiant
  local id mdp t essai
  for essai in 1 2 3; do
    read -r  -p "  Identifiant $1 (ex. $2) : " id
    read -rs -p "  Code d acces $1 : " mdp; echo
    t=$(jeton "$id" "$mdp"); mdp=''
    if [ -n "$t" ]; then
      echo "  session $1 ouverte pour « $id »" >&2
      printf '%s' "$t"
      return 0
    fi
    echo "  refuse (essai $essai sur 3) — identifiant ou code incorrect." >&2
  done
  return 1
}

TA=$(connexion A youangraoua) || { echo; echo "  Abandon : aucune session A. Rien n a ete encaisse."; exit 1; }
TB=$(connexion B dideal)      || { echo; echo "  Abandon : aucune session B. Rien n a ete encaisse."; exit 1; }
echo
echo "  Deux sessions ouvertes."

# ── Controle prealable, sans toucher a l argent ──────────────────────────
#
# Le premier essai a rendu deux reponses VIDES : ni resultat, ni erreur. On
# verifie donc d abord que chaque jeton parle vraiment au serveur, avec un
# appel inoffensif. S il repond, le jeton est bon et le probleme est ailleurs.
role() {
  curl -sS -X POST "$URL/rest/v1/rpc/ideal_role" \
    -H "apikey: $KEY" -H "Authorization: Bearer $1" \
    -H 'Content-Type: application/json' -d '{}' -w ' [http %{http_code}]' 2>&1
}
echo "  Role vu par le serveur pour A : $(role "$TA")"
echo "  Role vu par le serveur pour B : $(role "$TB")"
echo
echo "  Ces deux roles doivent etre « directeur » ou"
echo "  « responsable_administratif ». Sinon l encaissement sera refuse."

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
# `-sS` et non `-s` : le premier masque la barre de progression mais LAISSE
# passer les erreurs. Avec `-s` seul, un échec réseau produisait un fichier
# vide, et le script affichait « Réponse A : » suivi de rien — une panne
# muette prise pour un résultat.
appel() {   # $1 jeton, $2 montant, $3 mode, $4 suffixe de reçu
  curl -sS -X POST "$URL/rest/v1/rpc/enregistrer_paiement" \
    -H "apikey: $KEY" -H "Authorization: Bearer $1" -H 'Content-Type: application/json' \
    -w '\n  [http %{http_code}]' \
    -d "{\"p_matricule\":\"$MAT\",\"p_montant\":$2,\"p_mode\":\"$3\",\"p_motif\":\"Regularisation Globale\",\"p_recu\":\"COURSE-$STAMP-$4\",\"p_date_lisible\":\"course $STAMP\"}" 2>&1
}

# ── LES DEUX EN MÊME TEMPS ────────────────────────────────────────────
appel "$TA" 30000 'Espèces' A > /tmp/course-A.json &
PA=$!
appel "$TB" 50000 'Wave'    B > /tmp/course-B.json &
PB=$!
wait $PA; wait $PB

RA=$(cat /tmp/course-A.json); RB=$(cat /tmp/course-B.json)
echo "  Réponse A : ${RA:-(VIDE — la requête n a rien renvoyé)}"
echo "  Réponse B : ${RB:-(VIDE — la requête n a rien renvoyé)}"
echo
if [ -z "$RA" ] || [ -z "$RB" ]; then
  echo "  ✗ Au moins un appel n a rien renvoyé. Ce n est pas un resultat, c est"
  echo "    une panne : le test ne conclut rien. Verifiez la connexion reseau."
  rm -f /tmp/course-A.json /tmp/course-B.json
  exit 1
fi
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
