begin;

-- La photo du bulletin est exactement la photo officielle de l'inscription,
-- déjà utilisée par la carte scolaire. Aucun second fichier n'est créé.
create or replace function public.lire_photos_bulletins_maternelle(p_eleve_ids uuid[])
returns table (eleve_id uuid, photo_chemin text, photo_base64 text)
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_moi public.users%rowtype;
begin
  select u.* into v_moi from public.users u
   where u.auth_user_id=auth.uid() and u.actif=true limit 1;
  if v_moi.id is null then raise exception 'authentification_requise' using errcode='42501'; end if;
  return query
  select e.id, i.photo_chemin,
         case when e.photo_url like 'data:%' then e.photo_url else null end
    from public.eleves e
    left join public.inscriptions i on i.id=e.inscription_id
   where e.id=any(coalesce(p_eleve_ids,'{}'::uuid[]))
     and e.actif=true
     and (v_moi.role='directeur' or exists (
       select 1 from public.prof_classes pc
        where pc.user_id=v_moi.id and pc.classe_id=e.classe_id
     ));
end $$;

-- Prédicat étroit utilisé par Storage : une maîtresse authentifiée ne peut
-- signer que le fichier photo d'un élève appartenant à l'une de ses classes.
create or replace function public.peut_lire_photo_maternelle(p_chemin text)
returns boolean language sql stable security definer set search_path=public,pg_temp
as $$
  select exists (
    select 1
      from public.users u
      join public.prof_classes pc on pc.user_id=u.id
      join public.eleves e on e.classe_id=pc.classe_id and e.actif=true
      join public.inscriptions i on i.id=e.inscription_id
     where u.auth_user_id=auth.uid() and u.actif=true
       and i.photo_chemin=p_chemin
       and p_chemin like 'photos/%'
  )
$$;

drop policy if exists inscriptions_photos_maternelle on storage.objects;
create policy inscriptions_photos_maternelle on storage.objects
  for select to authenticated
  using (
    bucket_id='inscriptions'
    and name like 'photos/%'
    and public.peut_lire_photo_maternelle(name)
  );

revoke all on function public.lire_photos_bulletins_maternelle(uuid[]) from public,anon;
revoke all on function public.peut_lire_photo_maternelle(text) from public,anon;
grant execute on function public.lire_photos_bulletins_maternelle(uuid[]) to authenticated;
grant execute on function public.peut_lire_photo_maternelle(text) to authenticated;

commit;
