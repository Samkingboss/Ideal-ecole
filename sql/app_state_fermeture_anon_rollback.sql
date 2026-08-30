-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK de `sql/app_state_fermeture_anon.sql`
-- ═══════════════════════════════════════════════════════════════════════════
--
--   ⚠  ATTENTION :
--   ⚠  CE ROLLBACK RÉOUVRE APP_STATE À ANON.
--   ⚠  UTILISER UNIQUEMENT EN URGENCE.
--
-- Ce que cela signifie concrètement, pour que la décision soit prise en
-- connaissance de cause : la clé publique — celle qu'embarque le navigateur de
-- n'importe quel visiteur de la page d'inscription — redevient capable de LIRE
-- et de MODIFIER `rh/postes` (la grille des salaires), `rh/personnel`,
-- `rh/demandes_rh_global`, les boîtes de notifications et les rapports élèves.
--
-- N'exécuter que si la fermeture a coupé un flux vital qu'on ne peut pas
-- réparer dans l'heure, et refermer dès que possible.
--
-- ── Ce qui est restauré ───────────────────────────────────────────────────
--
--   · les trois policies `anon` — à l'identique du diagnostic du 30/08/2026
--   · les privilèges de table retirés à `anon`
--   · les privilèges de table retirés à `authenticated`
--
-- ── Ce qui est DÉLIBÉRÉMENT conservé ──────────────────────────────────────
--
-- Les deux policies `authenticated` créées par la fermeture ne sont PAS
-- supprimées. Les retirer casserait à nouveau toute écriture du personnel
-- connecté — un défaut qui existait avant la fermeture et qu'elle a réparé.
-- Un rollback ne doit pas réintroduire une panne au nom de la symétrie.
--
-- Un bloc facultatif, en fin de fichier et commenté, permet le retour à
-- l'état ANTÉRIEUR STRICT si c'est vraiment ce qui est voulu.

begin;

-- 1 · Les trois policies `anon`, telles qu'elles étaient.
create policy app_state_write
  on public.app_state
  for insert
  to anon
  with check (true);

create policy app_state_read
  on public.app_state
  for select
  to anon
  using (true);

create policy app_state_update
  on public.app_state
  for update
  to anon
  using (true);

-- 2 · Les privilèges de table retirés à `anon`.
grant select, insert, update, delete, truncate, references, trigger
  on table public.app_state to anon;

-- 3 · Les privilèges de table retirés à `authenticated`.
grant select, insert, update, delete, truncate, references, trigger
  on table public.app_state to authenticated;

-- 4 · Contrôle : la réouverture est-elle effective ?
do $$
begin
  if (select count(*) from pg_policies
       where schemaname = 'public' and tablename = 'app_state'
         and 'anon' = any(roles)) <> 3 then
    raise exception 'LES TROIS POLICIES anon NE SONT PAS TOUTES REVENUES';
  end if;
  if (select count(*) from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'app_state'
         and grantee = 'anon') = 0 then
    raise exception 'anon N A RECU AUCUN PRIVILEGE';
  end if;
end $$;

commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- FACULTATIF · retour à l'état ANTÉRIEUR STRICT
-- ═══════════════════════════════════════════════════════════════════════════
--
-- À n'exécuter que si l'on veut vraiment remettre la base telle qu'elle était,
-- panne comprise : sans ces deux policies, le personnel CONNECTÉ ne peut plus
-- écrire dans `app_state` — ce qui était l'état constaté le 30/08/2026.
--
-- begin;
-- drop policy if exists app_state_ecriture_personnel on public.app_state;
-- drop policy if exists app_state_maj_personnel      on public.app_state;
-- commit;
