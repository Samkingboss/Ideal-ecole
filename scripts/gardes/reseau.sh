#!/usr/bin/env bash
# Sondes en LECTURE SEULE contre la production. ~10 s.
#
# Jamais d'écriture, jamais de code d'accès réel, jamais de valeur sensible en
# sortie. Une garde qui manipulerait un secret pour le vérifier recréerait le
# problème qu'elle surveille.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$RACINE" || exit 2

KEY=$(grep -oE "SUPABASE_KEY = '[^']+'" public/inscription.html | sed "s/.*'\(.*\)'/\1/")
U=https://jircuneixzwsmtktxrkh.supabase.co
A=(-H "apikey: $KEY" -H "Authorization: Bearer $KEY")
AJ=("${A[@]}" -H 'Content-Type: application/json')
NIL=00000000-0000-0000-0000-000000000000

# Encapsulées : "${A[*]}" passé à eval perd ses guillemets, les en-têtes sont
# alors découpés et la clé n'arrive jamais.
http()   { curl -s -o /dev/null -w '%{http_code}' "$U/rest/v1/$1" "${A[@]}"; }
rpc()    { curl -s -X POST "$U/rest/v1/rpc/$1" "${AJ[@]}" -d "$2"; }
patch_u(){ curl -s -o /dev/null -w '%{http_code}' -X PATCH "$U/rest/v1/users?id=eq.$NIL" "${AJ[@]}" -d '{"actif":true}'; }
compte() { curl -s -I "$U/rest/v1/$1?select=id" "${A[@]}" -H 'Prefer: count=exact' \
             | grep -i content-range | tr -d '\r' | sed 's/.*\///'; }

ETAPE=$(python3 -c "import json;print(json.load(open('$ETAT'))['etape_migration'])" 2>/dev/null || echo avant-retrait)

titre "RÉSEAU · secrets hors de portée   [INV-SEC-01, INV-SEC-05]"

if [ "$ETAPE" = "apres-retrait" ]; then
  garde "L1 · users.code_acces n'est plus lisible"      "http 'users?select=code_acces&limit=1'"      "400"
  garde "L2 · users.plafond_salaire n'est plus lisible" "http 'users?select=plafond_salaire&limit=1'" "400"
  garde "L3 · users fermée en écriture"                 "patch_u"                                    "401"
else
  printf "  ${C_ATT}⧗${C_FIN} étape « %s » : le retrait n'a pas encore eu lieu\n" "$ETAPE"
  garde "L1 · users.code_acces encore présente (attendu)" "http 'users?select=code_acces&limit=1'" "200"
fi

garde "L4 · users_secrets fermée à anon"        "http 'users_secrets?select=user_id'" "401"
garde "L5 · schéma sauvegarde hors de l'API"    "http 'users_20260823?select=id'"     "404"
garde "L10 · generer_code_acces non exécutable" "http 'rpc/generer_code_acces'"       "401"

titre "RÉSEAU · l'authentification répond   [INV-SEC-05]"

# Fonction en lecture seule par construction : son corps ne contient qu'un SELECT.
garde "L6 · code inconnu → null, jamais d'exception" \
  "rpc authentifier_par_code '{\"p_code\":\"CODEQUINEXISTEPAS\"}'" "null"

titre "RÉSEAU · intégrité des données   [INV-SEC-04, INV-CONT-03]"

# ── Les champs lus par le code existent-ils réellement ? ──────────────────
#
# `custom_role` et `poste_id` ont été lus pendant des mois par le routeur.
# Aucune des deux colonnes n'a jamais existé : les tests étaient toujours
# faux, silencieusement. La liste est relue dans App.jsx plutôt que recopiée
# ici — une garde qui recopie ce qu'elle surveille ne surveille plus rien.
CHAMPS=$(sed -n '/^const CHAMPS_SESSION = \[/,/^\]/p' src/App.jsx \
         | grep -oE "'[a-z_]+'" | tr -d "'" | paste -sd, -)
garde "L11 · tout champ de session existe sur users" \
      "http 'users?select=$CHAMPS&limit=1'" "200"
# Contrôle négatif : la garde doit savoir échouer. Une colonne absente donne
# bien 400 — c'est ce que L11 aurait renvoyé pour custom_role.
garde "L12 · une colonne absente est bien refusée" \
      "http 'users?select=custom_role&limit=1'" "400"

# ── L7 · `users` n'est plus lisible par la clé publique ────────────────────
#
# Cette garde comptait les treize comptes AVEC LA CLÉ PUBLIQUE, pour prouver
# que la migration Auth n'avait perdu personne. Elle ne peut plus : la table
# est fermée à `anon` depuis la fermeture RLS, et c'est le but.
#
# Le compte des lignes n'a pas changé — c'est la LECTURE qui est fermée. La
# garde vérifie donc désormais la propriété qui compte aujourd'hui : l'annuaire
# du personnel n'est plus aspirable. Le volume se contrôle en session
# authentifiée, par `scripts/verif-rls-authentifie.sh`.
garde    "L7 · annuaire du personnel fermé à la clé publique" "compte users" "0"
plancher "journal_audit" "L8 · journal_audit ne perd aucune ligne" "$(compte journal_audit)"
garde    "L9 · users_secrets existe" \
  "[ \"\$(http 'users_secrets?select=user_id')\" = '401' ] && echo present || echo absent" "present"


# ── L13 · L1 et L2 discriminent-elles encore ? ─────────────────────────────
#
# L1 et L2 vérifient que `code_acces` et `plafond_salaire` répondent 400.
# Depuis la fermeture de `users` à `anon`, il fallait s'assurer qu'elles ne
# passent pas pour une mauvaise raison — une table fermée refusant TOUT.
#
# Mesuré : une colonne qui EXISTE mais dont les lignes sont filtrées répond
# 200 avec une liste vide ; une colonne ABSENTE répond 400. Les deux réponses
# diffèrent, donc L1 et L2 prouvent bien que la colonne n'existe plus, et non
# qu'on ne peut plus la lire.
#
# Si cette garde passe un jour à « vacues », L1 et L2 seront devenues des
# formalités et la preuve devra migrer vers le script authentifié.
garde "L13 · L1 et L2 discriminent encore" \
  "python3 - <<'PY'
import urllib.request, os
K = os.environ.get('KEY', '')
U = 'https://jircuneixzwsmtktxrkh.supabase.co/rest/v1'
def st(q):
    try:
        urllib.request.urlopen(urllib.request.Request(
            U + q, headers={'apikey': K, 'Authorization': 'Bearer ' + K}))
        return 200
    except Exception as e:
        return getattr(e, 'code', 0)
print('discriminantes' if st('/users?select=prenom&limit=1') != st('/users?select=colonne_qui_nexiste_pas&limit=1') else 'vacues')
PY" \
  "discriminantes"

bilan
