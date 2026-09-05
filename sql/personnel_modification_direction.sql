-- ═══════════════════════════════════════════════════════════════════════
-- MODIFICATION D'UNE FICHE DU PERSONNEL — DIRECTION UNIQUEMENT
--
-- Corrige l'identité métier, la fonction, la langue, le contact et les
-- classes sans recréer le compte. `identifiant` et `auth_user_id` ne sont
-- jamais modifiés : l'accès et tout l'historique restent rattachés au même id.
-- ═══════════════════════════════════════════════════════════════════════

begin;

create or replace function public.modifier_membre_personnel(
  p_user_id             uuid,
  p_prenom              text,
  p_nom                 text,
  p_role                text,
  p_langue              text,
  p_fonction            text,
  p_sexe                text,
  p_telephone           text,
  p_modifier_telephone  boolean,
  p_classe_ids          uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
declare
  v_avant           jsonb;
  v_apres           jsonb;
  v_classes_avant   jsonb;
  v_classes_apres   jsonb;
  v_prenom          text;
  v_nom             text;
  v_role            text;
  v_langue          text;
  v_fonction        text;
  v_sexe            text;
  v_telephone_avant text;
  v_telephone_apres text;
begin
  if not public.ideal_est(array['directeur']) then
    raise exception 'reserve_a_la_direction'
      using errcode = '42501',
            detail = 'Seule la Direction peut modifier une fiche du personnel.';
  end if;

  if p_user_id is null then
    raise exception 'personnel_manquant' using errcode = '22023';
  end if;

  v_prenom := nullif(btrim(coalesce(p_prenom, '')), '');
  v_nom := nullif(btrim(coalesce(p_nom, '')), '');
  v_role := nullif(btrim(coalesce(p_role, '')), '');
  v_langue := nullif(btrim(coalesce(p_langue, '')), '');
  v_fonction := nullif(btrim(coalesce(p_fonction, '')), '');
  v_sexe := upper(nullif(btrim(coalesce(p_sexe, '')), ''));

  if v_prenom is null or v_nom is null then
    raise exception 'identite_incomplete'
      using errcode = '22023', detail = 'Le prénom et le nom sont obligatoires.';
  end if;
  if v_role is null or v_role = 'directeur' then
    raise exception 'role_interdit'
      using errcode = '22023', detail = 'La fonction Direction ne peut pas être attribuée ici.';
  end if;
  if v_sexe is null or v_sexe not in ('F', 'M') then
    raise exception 'sexe_invalide'
      using errcode = '22023', detail = 'Le sexe doit être F ou M.';
  end if;

  select to_jsonb(u)
    into v_avant
    from public.users u
   where u.id = p_user_id
     and u.actif = true
     and u.role <> 'directeur'
   for update;

  if not found then
    raise exception 'personnel_introuvable'
      using errcode = 'P0002', detail = 'Aucun membre actif modifiable ne correspond à cet identifiant.';
  end if;

  select c.telephone
    into v_telephone_avant
    from public.personnel_contact c
   where c.user_id = p_user_id;

  select coalesce(jsonb_agg(pc.classe_id order by pc.classe_id), '[]'::jsonb)
    into v_classes_avant
    from public.prof_classes pc
   where pc.user_id = p_user_id;

  update public.users
     set prenom = v_prenom,
         nom = v_nom,
         role = v_role,
         langue = v_langue,
         fonction = v_fonction,
         sexe = v_sexe
   where id = p_user_id;

  if coalesce(p_modifier_telephone, false) then
    if nullif(btrim(coalesce(p_telephone, '')), '') is null then
      delete from public.personnel_contact where user_id = p_user_id;
    else
      insert into public.personnel_contact (user_id, telephone)
      values (p_user_id, btrim(p_telephone))
      on conflict (user_id) do update
         set telephone = excluded.telephone,
             updated_at = now();
    end if;
  end if;

  -- Les affectations appartiennent à la fiche actuelle : on remplace
  -- exactement la sélection de la Direction, dans la même transaction.
  delete from public.prof_classes where user_id = p_user_id;
  if v_role = 'professeur' then
    insert into public.prof_classes (user_id, classe_id, langue)
    select p_user_id, c.id, coalesce(v_langue, 'fr')
      from (
        select distinct unnest(coalesce(p_classe_ids, array[]::uuid[])) as id
      ) choix
      join public.classes c on c.id = choix.id
    on conflict do nothing;
  end if;

  select c.telephone
    into v_telephone_apres
    from public.personnel_contact c
   where c.user_id = p_user_id;

  select coalesce(jsonb_agg(pc.classe_id order by pc.classe_id), '[]'::jsonb)
    into v_classes_apres
    from public.prof_classes pc
   where pc.user_id = p_user_id;

  select to_jsonb(u)
    into v_apres
    from public.users u
   where u.id = p_user_id;

  v_avant := v_avant || jsonb_build_object(
    'telephone', v_telephone_avant,
    'classe_ids', v_classes_avant
  );
  v_apres := v_apres || jsonb_build_object(
    'telephone', v_telephone_apres,
    'classe_ids', v_classes_apres
  );

  if v_avant is distinct from v_apres then
    insert into public.journal_audit
      (table_cible, ligne_id, champ, ancienne_valeur, nouvelle_valeur,
       auteur_id, auteur_nom, action)
    values
      ('users', p_user_id::text, 'fiche_personnel', v_avant::text, v_apres::text,
       auth.uid(),
       coalesce((select u.prenom || ' ' || u.nom
                   from public.users u
                  where u.auth_user_id = auth.uid()), 'direction'),
       'modification_fiche_personnel');
  end if;

  return jsonb_build_object('ok', true, 'profil', v_apres);
end;
$function$;

revoke all on function public.modifier_membre_personnel(
  uuid,text,text,text,text,text,text,text,boolean,uuid[]
) from public, anon, authenticated;

grant execute on function public.modifier_membre_personnel(
  uuid,text,text,text,text,text,text,text,boolean,uuid[]
) to authenticated;

commit;

-- Attendu : « Success. No rows returned. »

-- Vérification en lecture seule :
-- select routine_name
--   from information_schema.routines
--  where routine_schema='public'
--    and routine_name='modifier_membre_personnel';
