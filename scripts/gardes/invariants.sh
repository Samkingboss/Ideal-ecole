#!/usr/bin/env bash
# Invariants métier issus du V2.1 et des décisions du promoteur.
# Chaque garde cite sa source : aucune ne vient d'une préférence technique.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$RACINE" || exit 2

titre "MÉTIER · cantine — D1, V2.1 §14"

# INV-CANT-01 — le defaut le plus grave de la plateforme. Une absence
# d'information ne doit jamais s'afficher comme une absence d'allergie.
N=$(grep -rnE "(allergies|restrictions)[^\n]*\|\| *['\"](Aucune|None|RAS|Ras)" src/ public/ 2>/dev/null | wc -l | tr -d ' ')
cliquet "allergies_repli_aucune" "M1 · repli « Aucune » sur donnée alimentaire  → 0 en phase 1" "$N"

# INV-UI-03 — cinq enfants fictifs peuvent encore s'afficher en cuisine.
N=$(grep -rn 'useState(DEMO_\|useState(SAMPLE_' src/ 2>/dev/null | wc -l | tr -d ' ')
cliquet "demo_en_etat_initial" "M2 · données de démo en état initial  → 0 en phase 1" "$N"

titre "MÉTIER · identité élève — D3, V2.1 §4"

# INV-ELEVE-01 — des jumeaux partagent nom et date de naissance.
garde "M3 · aucune fusion automatique d'élèves" \
  "grep -rniE 'merge_?eleve|fusion_?auto|auto_?merge' src/ sql/ 2>/dev/null | wc -l | tr -d ' '" "0"

titre "MÉTIER · signature — D2 option B"

# INV-SIG-03 — la signature reste inerte jusqu'a l'authentification serveur.
garde "M4 · signature non activée avant la phase 3" \
  "[ ! -f .phase4-signature-active ] && echo conforme || echo activee" "conforme"

titre "MÉTIER · source unique — R1, R2"

# INV-FLUX-02 — app_state est le principal ecart structurel au V2.1.
#
# La mesure precedente lisait une seule ligne : elle voyait 13 ecritures sur
# 17. Une chaine dont le `.upsert(` tombait a la ligne suivante lui etait
# invisible, et un simple retour a la ligne suffisait a passer sous le cliquet.
# Le plafond n'a pas ete relache : c'est la mesure qui etait aveugle.
N=$(node "$(dirname "${BASH_SOURCE[0]}")/compter-ecritures-app-state.mjs" | tr -d ' ')
cliquet "app_state_ecritures" "M5 · écritures dans app_state  → 0 en phase 5" "$N"

titre "MÉTIER · authentification — D5"

# Constat de la phase 3 : un compte désactivé obtenait quand même une
# session, et n'était refusé qu'à la résolution du profil. La désactivation
# doit être opposable des l'authentification, pas seulement apres.
garde "M7 · desactivation opposable des l'authentification" \
  "grep -c 'ban_duration' scripts/auth-migration.mjs | tr -d ' '" "2"

# `ideal_role()` filtre sur actif = true. C'est ce qui refuse un role a un
# employe desactive ; le retirer serait une regression de securite.
# Les deux fonctions du socle — ideal_profil et ideal_role — doivent filtrer
# sur actif. La propriete est « les deux filtrent », pas un compte fige : mon
# attendu de 3 etait faux, il y en a deux.
garde "M8 · ideal_profil et ideal_role refusent les inactifs" \
  "[ \"$(grep -c 'actif = true' sql/phase3_1_socle_auth.sql)\" -ge 2 ] && echo present || echo absent" "present"

bilan
