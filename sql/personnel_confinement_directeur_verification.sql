-- ============================================================
-- VÉRIFICATION — le compte Directeur est-il rattaché à Supabase Auth ?
-- LECTURE SEULE. Aucun secret n'apparaît dans le résultat.
-- À exécuter AVANT la migration : si la réponse est « non », la garde
-- `ideal_est(array['directeur'])` vous fermerait la porte.
-- ============================================================

select u.prenom,
       u.nom,
       u.role,
       u.actif,
       (u.auth_user_id is not null)                      as lien_auth_user_id,
       (au.id is not null)                               as identite_dans_auth_users,
       (u.actif and u.role = 'directeur' and au.id is not null)
                                                         as garde_passera
  from public.users u
  left join auth.users au on au.id = u.auth_user_id
 where u.role = 'directeur';

-- Attendu : une ligne, avec les trois booléens à `true`.
-- `garde_passera = false` ⇒ NE PAS EXÉCUTER LA MIGRATION, me le dire d'abord.
