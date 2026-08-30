-- ═══════════════════════════════════════════════════════════════════════════
-- DIAGNOSTIC AVANT FERMETURE DE `app_state` — LECTURE SEULE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Ce script NE MODIFIE RIEN. Il n'existe que pour produire les trois faits
-- sans lesquels le script de fermeture ne peut pas être écrit sans deviner.
--
-- Je ne peux pas obtenir ces faits moi-même : la clé publique n'atteint ni
-- `pg_policies`, ni `information_schema.role_table_grants`, ni `pg_class`.
-- Tout ce que j'ai mesuré est comportemental — les privilèges SELECT, INSERT,
-- UPDATE et DELETE répondent tous « accordé » à `anon`. Cela ne dit ni le nom
-- des policies, ni si le privilège vient de `anon` ou de `PUBLIC`.
--
-- Coller les trois résultats ; le script de fermeture sera écrit d'après eux.

-- 1 · LES POLICIES
--
-- Ce qu'il faut y lire :
--   · `roles` = {anon}    → policy à retirer, elle ne sert que la clé publique
--   · `roles` = {public}  → NE PAS RETIRER : elle couvre aussi `authenticated`.
--                           Il faudra la remplacer par une policy `TO
--                           authenticated` portant le même prédicat.
select policyname, cmd, permissive, roles, qual, with_check
  from pg_policies
 where schemaname = 'public' and tablename = 'app_state'
 order by cmd, policyname;

-- 2 · LES PRIVILÈGES
--
-- Ce qu'il faut y lire : la valeur exacte de `grantee`.
--   · grantee = 'anon'    → `revoke ... from anon` suffit et n'affecte que lui
--   · grantee = 'PUBLIC'  → `revoke ... from anon` serait SANS EFFET. Il faut
--                           viser PUBLIC, ce qui retire aussi le droit à
--                           `authenticated` : il faudra le lui regranter
--                           explicitement dans la MÊME transaction.
select grantee, privilege_type, is_grantable
  from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'app_state'
 order by grantee, privilege_type;

-- 3 · L'ÉTAT DE RLS
--
-- `relforcerowsecurity = false` signifie que le propriétaire de la table
-- contourne les policies. C'est ce qui permettra à l'éditeur SQL de supprimer
-- les huit lignes de sonde sans qu'aucune policy DELETE soit créée.
select relrowsecurity, relforcerowsecurity
  from pg_class
 where oid = 'public.app_state'::regclass;

-- 4 · CE QUE `authenticated` UTILISE RÉELLEMENT
--
-- Pour ne conserver que les opérations des workflows autorisés, et pas une
-- de plus. Inventaire mesuré dans le dépôt au 30/08/2026 :
--
--   SELECT  ·  oui — notifications, registre RH, cantine, postes, rapports
--   INSERT  ·  oui — première écriture d'une clé absente (etatPartage.js)
--   UPDATE  ·  oui — écriture conditionnelle (etatPartage.js)
--   DELETE  ·  NON — aucun appel dans src/ ni public/. Aucune policy DELETE
--              n'existe aujourd'hui, et il ne faut pas en créer.
--
-- Contrôle indépendant du dépôt :
select 'aucun appel DELETE sur app_state dans le code livre' as note;
