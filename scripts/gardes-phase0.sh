#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# GARDES DE NON-RÉGRESSION — PHASE 0
# ═══════════════════════════════════════════════════════════════════════
#
# Vérifie que le travail de la phase 0 n'a pas été défait, et signale où.
#
#   ./scripts/gardes-phase0.sh            statique + réseau
#   ./scripts/gardes-phase0.sh --statique statique seulement (rapide, hors ligne)
#
# ── Deux familles, deux usages ─────────────────────────────────────────
#
# STATIQUES  — lecture de fichiers, instantanées, sans réseau ni secret.
#              Destinées à devenir un Hook PostToolUse : elles attrapent
#              la réintroduction d'un secret au moment de la frappe.
#
# RÉSEAU     — sondes en LECTURE SEULE contre la production. Trop lentes
#              pour chaque édition, faites pour une Loop périodique et
#              pour le contrôle qui précède un déploiement.
#
# ── Ce que ce script ne fera jamais ────────────────────────────────────
#
# Aucune écriture, aucun code d'accès réel, aucune valeur sensible en
# sortie. Une garde qui manipulerait un secret pour le vérifier
# recréerait le problème qu'elle surveille.

set -uo pipefail
cd "$(dirname "$0")/.." || exit 2

STATIQUE_SEUL=0
[ "${1:-}" = "--statique" ] && STATIQUE_SEUL=1

OK=0; KO=0
V='\033[0;32m'; R='\033[0;31m'; J='\033[0;33m'; G='\033[0;90m'; N='\033[0m'

titre() { printf "\n${G}── %s ──${N}\n" "$1"; }

# garde <libellé> <commande> <attendu>
garde() {
  local libelle="$1" cmd="$2" attendu="$3" obtenu
  obtenu=$(eval "$cmd" 2>/dev/null)
  printf "  %-52s " "$libelle"
  if [ "$obtenu" = "$attendu" ]; then
    printf "${V}✓${N}\n"; OK=$((OK+1))
  else
    printf "${R}✗  attendu %s, obtenu %s${N}\n" "$attendu" "${obtenu:-<vide>}"; KO=$((KO+1))
  fi
}

# ═══════════════════════════════════════════════════════════════════════
titre "STATIQUES · le secret ne doit pas revenir dans le code"
# ═══════════════════════════════════════════════════════════════════════

# H1 — le cœur du dispositif. `p.code_acces` était affiché à trois endroits
# de la liste du personnel ; le retrait ne doit pas être annulé par mégarde.
garde "H1 · aucune lecture de p.code_acces / p.plafond" \
  "grep -rn 'p\.code_acces\|p\.plafond_salaire' src/ public/ 2>/dev/null | wc -l | tr -d ' '" "0"

# H2 — les écritures passent par les RPC. Un `upsert` qui reviendrait
# échouerait en production (droits révoqués) sans que rien ne l'annonce.
garde "H2 · aucune écriture directe sur users" \
  "grep -rn \"from('users')\" src/ public/ 2>/dev/null | grep -cE 'insert|update|upsert|delete' | tr -d ' '" "0"

garde "H3 · aucun select de code_acces" \
  "grep -rn 'select.*code_acces' src/ public/ 2>/dev/null | wc -l | tr -d ' '" "0"

garde "H4 · les trois appels RPC sont en place" \
  "grep -rn 'authentifier_par_code\|enregistrer_utilisateur\|desactiver_utilisateur' src/ 2>/dev/null | wc -l | tr -d ' '" "3"

garde "H5 · liste blanche de session déclarée" \
  "grep -c 'CHAMPS_SESSION' src/App.jsx | tr -d ' '" "2"

garde "H6 · purge des sessions contaminées" \
  "grep -c 'CHAMPS_SENSIBLES.some' src/App.jsx | tr -d ' '" "1"

# H7 — la distinction « code faux » / « serveur injoignable » est un acquis
# explicite du code. La perdre renverrait chercher une panne inexistante.
garde "H7 · distinction code faux / panne réseau" \
  "grep -c 'estPanneReseau' src/pages/LoginPage.jsx | tr -d ' '" "3"

garde "H8 · les scripts SQL de la phase sont versionnés" \
  "ls sql/phase0_*.sql 2>/dev/null | wc -l | tr -d ' '" "6"

titre "STATIQUES · le build"
garde "H9 · le projet compile" \
  "npx vite build >/dev/null 2>&1 && echo ok || echo echec" "ok"

if [ "$STATIQUE_SEUL" = "1" ]; then
  printf "\n  ${G}%s garde(s) au vert, %s en échec — réseau non testé${N}\n\n" "$OK" "$KO"
  [ "$KO" -eq 0 ] && exit 0 || exit 1
fi

# ═══════════════════════════════════════════════════════════════════════
titre "RÉSEAU · sondes en lecture seule contre la production"
# ═══════════════════════════════════════════════════════════════════════

KEY=$(grep -oE "SUPABASE_KEY = '[^']+'" public/inscription.html | sed "s/.*'\(.*\)'/\1/")
U=https://jircuneixzwsmtktxrkh.supabase.co
A=(-H "apikey: $KEY" -H "Authorization: Bearer $KEY")

http() { curl -s -o /dev/null -w '%{http_code}' "$U/rest/v1/$1" "${A[@]}"; }

# Encapsulées plutôt qu'inlinées : passer "${A[*]}" à eval fait perdre les
# guillemets, les en-têtes sont alors découpés et la clé n'arrive pas.
rpc()   { curl -s -X POST "$U/rest/v1/rpc/$1" "${A[@]}" \
            -H 'Content-Type: application/json' -d "$2"; }
patch_() { curl -s -o /dev/null -w '%{http_code}' -X PATCH \
            "$U/rest/v1/users?id=eq.00000000-0000-0000-0000-000000000000" "${A[@]}" \
            -H 'Content-Type: application/json' -d '{"actif":true}'; }
compte() { curl -s -I "$U/rest/v1/$1?select=id" "${A[@]}" -H 'Prefer: count=exact' \
            | grep -i content-range | tr -d '\r' | sed 's/.*\///'; }

# L1 — la garde qui compte. Tant que la phase 0 n'est pas terminée, la
# colonne existe encore (200 attendu) ; après l'étape 6, ce sera 400.
# Le script lit l'état attendu dans un fichier témoin plutôt que de le
# deviner, pour ne pas crier au loup pendant la fenêtre de migration.
ETAPE=$(cat .phase0-etape 2>/dev/null || echo "avant-retrait")

if [ "$ETAPE" = "apres-retrait" ]; then
  garde "L1 · users.code_acces N'EST PLUS lisible" \
    "http 'users?select=code_acces&limit=1'" "400"
  garde "L2 · users.plafond_salaire N'EST PLUS lisible" \
    "http 'users?select=plafond_salaire&limit=1'" "400"
  garde "L3 · users fermée en écriture" "patch_" "401"
else
  printf "  ${J}⧗${N} L1-L3 · étape « %s » : le retrait n'a pas encore eu lieu\n" "$ETAPE"
  garde "L1 · users.code_acces encore présente (attendu)" \
    "http 'users?select=code_acces&limit=1'" "200"
fi

garde "L4 · users_secrets fermée à anon" \
  "http 'users_secrets?select=user_id'" "401"

garde "L5 · schéma sauvegarde hors de portée de l'API" \
  "http 'users_20260823?select=id'" "404"

garde "L6 · authentifier_par_code répond sans exception" \
  "rpc authentifier_par_code '{\"p_code\":\"CODEQUINEXISTEPAS\"}'" "null"

garde "L7 · volume users inchangé" "compte users" "13"
garde "L8 · volume journal_audit conforme" "compte journal_audit" "75"

# L9 — sans secrets recopiés, l'étape 6 détruirait les codes. Le script SQL
# refuse déjà de s'exécuter dans ce cas ; on le voit aussi d'ici.
garde "L9 · users_secrets existe (créée à l'étape 2)" \
  "[ \"\$(http 'users_secrets?select=user_id')\" = '401' ] && echo present || echo absent" "present"

printf "\n"
if [ "$KO" -eq 0 ]; then
  printf "  ${V}%s garde(s) au vert, aucune en échec.${N}\n\n" "$OK"; exit 0
else
  printf "  ${R}%s garde(s) au vert, %s EN ÉCHEC.${N}\n\n" "$OK" "$KO"; exit 1
fi
