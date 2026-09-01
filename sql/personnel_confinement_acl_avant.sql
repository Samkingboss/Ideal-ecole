-- ============================================================
-- INSPECTION — ACL réelles des surfaces de gestion du personnel
-- LECTURE SEULE. À exécuter AVANT la migration, et à me renvoyer.
--
-- Le point à prouver : PostgreSQL accorde EXECUTE à PUBLIC par défaut.
-- Ce défaut ne se voit PAS dans pg_proc.proacl : quand aucun GRANT ni
-- REVOKE explicite n'a jamais été passé, `proacl` vaut NULL et le droit
-- implicite reste invisible. D'où le `coalesce(..., acldefault(...))` :
-- il matérialise le défaut au lieu de le laisser passer pour une absence.
-- ============================================================

select p.proname                                        as fonction,
       pg_get_function_identity_arguments(p.oid)        as arguments,
       case when p.proacl is null
            then 'DÉFAUT implicite (aucun GRANT/REVOKE explicite)'
            else 'ACL explicite'
       end                                              as origine,
       case when a.grantee = 0
            then 'PUBLIC'
            else pg_get_userbyid(a.grantee)
       end                                              as beneficiaire,
       a.privilege_type                                 as privilege
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join lateral
       aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
 where n.nspname = 'public'
   and p.proname in ('enregistrer_utilisateur',
                     'desactiver_utilisateur',
                     'authentifier_par_code')
   and a.privilege_type = 'EXECUTE'
 order by fonction, beneficiaire;
