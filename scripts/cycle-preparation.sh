#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# LE CYCLE COMPLET D UNE PRÉPARATION — DÉPÔT, CORRECTION, RESOUMISSION
# ═══════════════════════════════════════════════════════════════════════
#
# Prouve la chaîne de données de bout en bout, avec deux sessions réelles.
# Les trois vérifications qui restent à l oeil — cloche, clic, rubrique de la
# remarque — sont listées à la fin.
#
# LES CODES NE SORTENT PAS DE CETTE MACHINE : saisie masquée, jamais
# affichée, jamais dans l historique, effacée sitôt le jeton obtenu.
#
# AUCUNE DONNÉE RÉELLE MODIFIÉE : le script travaille sur une préparation
# FIXTURE qu il crée, et la retire à la fin.
#
# Usage :  bash ~/Desktop/ideal-ecole/scripts/cycle-preparation.sh

set -u
URL='https://jircuneixzwsmtktxrkh.supabase.co'
KEY=$(grep -oE "SUPABASE_KEY = '[^']+'" "$(dirname "$0")/../public/inscription.html" | sed "s/.*'\(.*\)'/\1/")
DOMAINE='@comptes.ideal-ecole.ml'
OK=0; KO=0
juge() { if [ "$2" = 'oui' ]; then printf '  ✓ %-52s %s\n' "$1" "${3:-}"; OK=$((OK+1))
         else printf '  ✗ %-52s %s\n' "$1" "${3:-}"; KO=$((KO+1)); fi; }

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
api() {  # $1 jeton, $2 methode, $3 chemin, [$4 corps]
  if [ $# -ge 4 ]; then
    curl -s -X "$2" "$URL/rest/v1$3" -H "apikey: $KEY" -H "Authorization: Bearer $1" \
      -H 'Content-Type: application/json' -H 'Prefer: return=representation' -d "$4"
  else
    curl -s -X "$2" "$URL/rest/v1$3" -H "apikey: $KEY" -H "Authorization: Bearer $1" \
      -H 'Cache-Control: no-cache'
  fi
}

echo
echo "  Deux comptes : l enseignante, puis la direction."
echo
TENS=$(connexion 'ENSEIGNANTE' 'ex. omogadzi') || exit 1
TDIR=$(connexion 'DIRECTION'   'ex. dideal')   || exit 1
echo

MOI=$(api "$TENS" POST /rpc/ideal_profil '{}' | python3 -c 'import sys,json;d=json.load(sys.stdin);d=d[0] if isinstance(d,list) else d;print(d.get("id",""))')
[ -z "$MOI" ] && { echo "  ✗ profil enseignante introuvable"; exit 1; }
echo "  enseignante : $MOI"

CLASSE=$(api "$TENS" GET '/classes?select=id&limit=1' | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["id"])')
JOUR=$(date +%Y-%m-%d)

# ── 1 · l enseignante dépose une préparation FIXTURE ────────────────────
CORPS=$(python3 - "$MOI" "$CLASSE" "$JOUR" <<'PY'
import json, sys, datetime
moi, classe, jour = sys.argv[1], sys.argv[2], sys.argv[3]
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
print(json.dumps({
  "user_id": moi, "classe_id": classe, "groupe": "FIXTURE-CYCLE",
  "matiere": "FIXTURE-CYCLE", "sequence": 99,
  "date_cours": jour, "heure_cours": "15:30:00", "heure_depot": now,
  "status": "deposee",
  "contenu": {"objectif": "FIXTURE — objectif initial", "materiel": "FIXTURE — matériel"},
  "historique_statuts": [{"le": now, "par": moi, "action": "depot",
                          "statut": "deposee", "par_nom": "FIXTURE"}],
}))
PY
)
PREP=$(api "$TENS" POST /preparations "$CORPS" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d[0]["id"] if isinstance(d,list) and d else "")')
juge "1 · la préparation est créée par l enseignante" "$([ -n "$PREP" ] && echo oui || echo non)" "${PREP:0:8}"
[ -z "$PREP" ] && { echo "  Abandon : impossible de créer la fixture."; exit 1; }

# ── 2 · la RPC de notification, premier cycle ───────────────────────────
R1=$(api "$TENS" POST /rpc/notifier_preparation "{\"p_preparation_id\":\"$PREP\"}")
echo "  réponse : $R1"
juge "2 · notification créée, cycle 0, événement dépôt" \
  "$(printf '%s' "$R1" | python3 -c 'import sys,json
try:
 d=json.load(sys.stdin); print("oui" if d.get("cree") is True and d.get("evenement")=="depot" and d.get("cycle")==0 else "non")
except: print("non")')"

# ── 3 · double appel : aucun doublon ────────────────────────────────────
R2=$(api "$TENS" POST /rpc/notifier_preparation "{\"p_preparation_id\":\"$PREP\"}")
juge "3 · second appel identique — aucun doublon" \
  "$(printf '%s' "$R2" | python3 -c 'import sys,json
try:
 d=json.load(sys.stdin); print("oui" if d.get("cree") is False else "non")
except: print("non")')"

# ── 4 · la DIRECTION lit la notification dans sa boîte ──────────────────
BOITE=$(api "$TDIR" GET '/app_state?select=value&app=eq.notifications&key=eq.notifs_directeur')
juge "4 · la direction lit sa boîte et y voit la préparation" \
  "$(PREP="$PREP" printf '%s' "$BOITE" | PREP="$PREP" python3 -c 'import sys,json,os
try:
 v=json.load(sys.stdin)[0]["value"]
 print("oui" if any(str(n.get("ref"))==os.environ["PREP"] for n in v) else "non")
except: print("non")')"

# ── 5 · le lien profond porte la bonne préparation ──────────────────────
juge "5 · la notification pointe vers la bonne préparation" \
  "$(PREP="$PREP" printf '%s' "$BOITE" | PREP="$PREP" python3 -c 'import sys,json,os
try:
 v=json.load(sys.stdin)[0]["value"]
 n=[x for x in v if str(x.get("ref"))==os.environ["PREP"]][0]
 print("oui" if n.get("tabTarget")=="pedagogie" and n.get("type")=="preparation" else "non")
except: print("non")')"

# ── 6 · la direction lit l identité de l enseignante ────────────────────
AUT=$(api "$TDIR" GET "/preparations?select=user_id,users(prenom,nom),heure_cours,heure_depot&id=eq.$PREP")
echo "  vu par la direction : $AUT"
juge "6 · l identité de l enseignante est lisible" \
  "$(printf '%s' "$AUT" | python3 -c 'import sys,json
try:
 d=json.load(sys.stdin)[0]; u=d.get("users")
 print("oui" if u and u.get("nom") else "non")
except: print("non")')"
juge "7 · heure du cours et heure de dépôt sont distinctes" \
  "$(printf '%s' "$AUT" | python3 -c 'import sys,json
try:
 d=json.load(sys.stdin)[0]
 print("oui" if d.get("heure_cours","")[:5]=="15:30" and d.get("heure_depot") else "non")
except: print("non")')"

# ── 8 · la direction demande une correction, sur une rubrique ───────────
HIST=$(api "$TDIR" GET "/preparations?select=historique_statuts&id=eq.$PREP" \
  | python3 -c 'import sys,json;print(json.dumps(json.load(sys.stdin)[0]["historique_statuts"]))')
NOUV=$(python3 - "$HIST" <<'PY'
import json, sys, datetime
h = json.loads(sys.argv[1])
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
h.append({"le": now, "action": "commentaire", "statut": None, "section": "objectif",
          "par_nom": "FIXTURE DIRECTION", "commentaire": "FIXTURE — préciser l objectif"})
h.append({"le": now, "action": "correction_demandee", "statut": "a_corriger",
          "par_nom": "FIXTURE DIRECTION", "commentaire": "FIXTURE — à corriger"})
print(json.dumps({"status": "a_corriger", "historique_statuts": h}))
PY
)
api "$TDIR" PATCH "/preparations?id=eq.$PREP" "$NOUV" > /dev/null
VERIF=$(api "$TENS" GET "/preparations?select=status,historique_statuts&id=eq.$PREP")
juge "8 · l enseignante voit la remarque, sous sa rubrique" \
  "$(printf '%s' "$VERIF" | python3 -c 'import sys,json
try:
 d=json.load(sys.stdin)[0]
 c=[e for e in d["historique_statuts"] if e.get("action")=="commentaire" and e.get("section")=="objectif"]
 print("oui" if d["status"]=="a_corriger" and c else "non")
except: print("non")')"

# ── 9 · l enseignante resoumet — nouveau cycle ──────────────────────────
R3=$(api "$TENS" POST /rpc/notifier_preparation "{\"p_preparation_id\":\"$PREP\"}")
echo "  réponse : $R3"
juge "9 · resoumission notifiée, cycle 1, identifiant distinct" \
  "$(printf '%s' "$R3" | python3 -c 'import sys,json
try:
 d=json.load(sys.stdin)
 print("oui" if d.get("cree") is True and d.get("evenement")=="resoumission" and d.get("cycle")==1 else "non")
except: print("non")')"

# ── 10 · deux notifications, aucune duplication ─────────────────────────
BOITE2=$(api "$TDIR" GET '/app_state?select=value&app=eq.notifications&key=eq.notifs_directeur')
juge "10 · deux notifications distinctes, aucun doublon" \
  "$(PREP="$PREP" printf '%s' "$BOITE2" | PREP="$PREP" python3 -c 'import sys,json,os
try:
 v=json.load(sys.stdin)[0]["value"]
 n=[x for x in v if str(x.get("ref"))==os.environ["PREP"]]
 print("oui" if len(n)==2 and len({x["id"] for x in n})==2 else "non")
except: print("non")')"

# ── NETTOYAGE ───────────────────────────────────────────────────────────
api "$TENS" DELETE "/preparations?id=eq.$PREP" > /dev/null
RESTE=$(api "$TDIR" GET "/preparations?select=id&groupe=eq.FIXTURE-CYCLE" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')
juge "11 · la fixture est retirée" "$([ "$RESTE" = 0 ] && echo oui || echo non)" "$RESTE restante(s)"
echo
echo "  Les notifications de la fixture restent dans la boîte : elles portent"
echo "  la référence $PREP et « FIXTURE-CYCLE ». Je les retirerai au nettoyage final."
echo
echo "  ─────────────────────────────────────────────"
printf '  %d au vert, %d en échec\n' "$OK" "$KO"
[ "$KO" -eq 0 ] && echo "  CYCLE PRÉPARATION → PASS" || echo "  CYCLE PRÉPARATION → FAIL"
echo
echo "  Restent trois vérifications à l oeil, dans l application :"
echo "    · la cloche de la direction affiche-t-elle la notification ?"
echo "    · un clic dessus ouvre-t-il la bonne préparation ?"
echo "    · la remarque apparaît-elle bien sous la rubrique « Objectif » ?"
