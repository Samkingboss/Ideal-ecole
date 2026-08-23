-- ═══════════════════════════════════════════════════════════════════════
-- PHASE 0 — ÉTAPE 6 : RETIRER
-- ═══════════════════════════════════════════════════════════════════════
--
--                        ⚠  POINT DE NON-RETOUR  ⚠
--
-- N'exécuter ce script QUE si le point de contrôle 5 est intégralement
-- passé :
--
--   • `phase0_1_creation.sql` appliqué, ses deux vérifications à 13|13|0 et 0 ;
--   • frontend déployé et actif en production ;
--   • les 9 comptes actifs se connectent PAR L'ÉCRAN ;
--   • création, modification et désactivation d'un compte de test vérifiées ;
--   • les 9 écrans lisant `users` s'affichent normalement.
--
-- Si un seul de ces points échoue : NE PAS EXÉCUTER. Revenir en arrière par
-- un simple retour au déploiement Vercel précédent — les colonnes existent
-- encore, rien n'est perdu.
--
-- Après ce script, le retour arrière exige `phase0_retour_arriere.sql`,
-- SQL d'abord et frontend ensuite.

begin;

-- ── 1 · Garde-fou : refuser si la recopie n'est pas intègre ────────────
--
-- Supprimer une colonne dont le contenu n'a pas été intégralement recopié
-- détruirait les codes d'accès sans copie de sûreté. Ce bloc rend la chose
-- impossible : il compare les deux tables avant toute suppression et avorte
-- la transaction au moindre écart.

do $$
declare
  n_manquants integer;
  n_diverge   integer;
begin
  select count(*) into n_manquants
    from public.users u
    left join public.users_secrets s on s.user_id = u.id
   where s.user_id is null;

  if n_manquants > 0 then
    raise exception
      'ARRET : % compte(s) sans secret recopie. Suppression refusee.', n_manquants;
  end if;

  select count(*) into n_diverge
    from public.users u
    join public.users_secrets s on s.user_id = u.id
   where u.code_acces is distinct from s.code_acces
      or u.plafond_salaire is distinct from s.plafond_salaire;

  if n_diverge > 0 then
    raise exception
      'ARRET : % divergence(s) entre users et users_secrets. Suppression refusee.', n_diverge;
  end if;

  raise notice 'Integrite verifiee : recopie complete et conforme. Suppression autorisee.';
end
$$;

-- ── 2 · Suppression des colonnes sensibles ─────────────────────────────
--
-- `code_acces` porte une contrainte NOT NULL : la vider est impossible,
-- la supprimer est la seule voie. Les valeurs restent dans `users_secrets`.
--
-- `residence`, `email` et `telephone` sont vides et ne sont PAS touchées :
-- les supprimer n'apporterait rien et ajouterait une commande destructrice
-- sans contrepartie.

alter table public.users drop column code_acces;
alter table public.users drop column plafond_salaire;

-- ── 3 · Fermeture des écritures ────────────────────────────────────────
--
-- SELECT reste accordé : neuf écrans lisent `users`, dont cinq en
-- `select('*')`. Les colonnes sensibles ayant disparu de la table, cette
-- lecture ne présente plus de risque.
--
-- Les fonctions SECURITY DEFINER de l'étape 2 continuent d'écrire : elles
-- s'exécutent avec les droits de leur propriétaire, pas ceux de `anon`.

revoke insert, update, delete on public.users from anon, authenticated;

-- ── 4 · Journal d'audit en ajout seul ──────────────────────────────────
--
-- INSERT et SELECT conservés : `src/lib/audit.js` ligne 33 en dépend, et
-- les fonctions de l'étape 2 y écrivent leurs traces.
-- UPDATE et DELETE fermés : une trace écrite ne se réécrit plus.

revoke update, delete on public.journal_audit from anon, authenticated;

commit;


-- ═══════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS — après le COMMIT
-- ═══════════════════════════════════════════════════════════════════════

-- Les colonnes ont bien disparu de `users`, et de nulle part ailleurs.
select count(*) as colonnes_sensibles_restantes
  from information_schema.columns
 where table_schema = 'public'
   and table_name   = 'users'
   and column_name in ('code_acces', 'plafond_salaire');
-- attendu : 0

-- Les secrets sont intacts dans leur table.
select count(*) as secrets_conserves from public.users_secrets;
-- attendu : 13

-- Le compte du directeur est toujours là et actif.
select count(*) as directeur_actif
  from public.users where role = 'directeur' and actif = true;
-- attendu : 1
