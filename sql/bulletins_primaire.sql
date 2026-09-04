-- Bulletins trimestriels du primaire : une source partagée par les
-- enseignants d'une même classe, sans ressaisie de l'identité de l'élève.
-- Chaque enseignant ne peut écrire que les matières qui lui sont affectées.
--
-- À exécuter une fois dans le SQL Editor Supabase.

begin;

create table if not exists public.primaire_bulletins (
  id uuid primary key default gen_random_uuid(),
  eleve_id uuid not null references public.eleves(id) on delete cascade,
  trimestre text not null check (trimestre in ('t1','t2','t3')),
  annee_scolaire text not null,
  donnees jsonb not null default '{"matieres":{}}'::jsonb,
  historique jsonb not null default '[]'::jsonb,
  updated_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint primaire_bulletins_eleve_periode_unique
    unique (eleve_id, trimestre, annee_scolaire)
);

alter table public.primaire_bulletins enable row level security;
revoke all on table public.primaire_bulletins from public, anon, authenticated;

create or replace function public.lire_bulletins_primaire(p_eleve_ids uuid[])
returns table (
  eleve_id uuid,
  trimestre text,
  annee_scolaire text,
  donnees jsonb,
  updated_at timestamptz
)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_moi public.users%rowtype;
begin
  select u.* into v_moi
    from public.users u
   where u.auth_user_id = auth.uid() and u.actif = true
   limit 1;

  if v_moi.id is null then
    raise exception 'authentification_requise' using errcode = '42501';
  end if;

  return query
  select b.eleve_id, b.trimestre, b.annee_scolaire, b.donnees, b.updated_at
    from public.primaire_bulletins b
    join public.eleves e on e.id = b.eleve_id
    join public.classes c on c.id = e.classe_id
   where b.eleve_id = any(coalesce(p_eleve_ids, '{}'::uuid[]))
     and c.nom not in ('PS','GS','Petite Section','Grande Section')
     and (
       v_moi.role in ('directeur','responsable_administratif')
       or exists (
         select 1 from public.prof_classes pc
          where pc.user_id = v_moi.id and pc.classe_id = e.classe_id
       )
     );
end;
$$;

create or replace function public.sauver_evaluation_primaire(
  p_eleve_id uuid,
  p_trimestre text,
  p_annee_scolaire text,
  p_matiere text,
  p_notes jsonb,
  p_appreciation text
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_moi public.users%rowtype;
  v_classe_id uuid;
  v_classe_nom text;
  v_programme text;
  v_notes jsonb;
  v_note jsonb;
  v_modalite text;
  v_payload jsonb;
  v_ancien jsonb;
  v_id uuid;
begin
  select u.* into v_moi
    from public.users u
   where u.auth_user_id = auth.uid() and u.actif = true
   limit 1;

  if v_moi.id is null then
    raise exception 'authentification_requise' using errcode = '42501';
  end if;
  if p_trimestre not in ('t1','t2','t3') then
    raise exception 'trimestre_invalide';
  end if;
  if nullif(btrim(p_annee_scolaire), '') is null then
    raise exception 'annee_scolaire_requise';
  end if;
  if nullif(btrim(p_matiere), '') is null then
    raise exception 'matiere_requise';
  end if;

  select e.classe_id, c.nom
    into v_classe_id, v_classe_nom
    from public.eleves e
    join public.classes c on c.id = e.classe_id
   where e.id = p_eleve_id
     and e.actif = true
     and c.nom not in ('PS','GS','Petite Section','Grande Section');

  if v_classe_id is null then
    raise exception 'eleve_primaire_introuvable' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
     from public.affectations_matieres a
     where a.prof_id = v_moi.id
       and lower(btrim(v_classe_nom)) = any(
         regexp_split_to_array(lower(btrim(a.groupe)), '\\s*/\\s*')
       )
       and lower(btrim(a.matiere)) = lower(btrim(p_matiere))
  ) then
    raise exception 'matiere_non_affectee' using errcode = '42501';
  end if;

  select case when h.langue = 'en' then 'international' else 'national' end
    into v_programme
    from public.pilotage_heures_pedagogiques h
   where h.classe_id = v_classe_id
     and lower(btrim(h.matiere)) = lower(btrim(p_matiere))
   limit 1;

  v_programme := coalesce(
    v_programme,
    case when v_moi.langue = 'en' then 'international' else 'national' end
  );
  v_notes := coalesce(p_notes, '{}'::jsonb);

  if jsonb_typeof(coalesce(v_notes->'ecrit', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(v_notes->'oral', '[]'::jsonb)) <> 'array' then
    raise exception 'notes_invalides';
  end if;

  foreach v_modalite in array array['ecrit','oral'] loop
    for v_note in
      select value from jsonb_array_elements(coalesce(v_notes->v_modalite, '[]'::jsonb))
    loop
      if nullif(v_note->>'note', '') is null
         or nullif(v_note->>'bareme', '') is null
         or (v_note->>'bareme')::numeric <= 0
         or (v_note->>'note')::numeric < 0
         or (v_note->>'note')::numeric > (v_note->>'bareme')::numeric then
        raise exception 'note_hors_bareme';
      end if;
    end loop;
  end loop;

  v_payload := jsonb_build_object(
    'matiere', btrim(p_matiere),
    'programme', v_programme,
    'notes', jsonb_build_object(
      'ecrit', coalesce(v_notes->'ecrit', '[]'::jsonb),
      'oral', coalesce(v_notes->'oral', '[]'::jsonb)
    ),
    'appreciation', coalesce(btrim(p_appreciation), ''),
    'enseignant', jsonb_build_object(
      'id', v_moi.id,
      'prenom', v_moi.prenom,
      'nom', v_moi.nom,
      'fonction', v_moi.fonction
    ),
    'updated_at', now()
  );

  select b.donnees->'matieres'->btrim(p_matiere)
    into v_ancien
    from public.primaire_bulletins b
   where b.eleve_id = p_eleve_id
     and b.trimestre = p_trimestre
     and b.annee_scolaire = btrim(p_annee_scolaire);

  insert into public.primaire_bulletins(
    eleve_id, trimestre, annee_scolaire, donnees, historique, updated_by
  ) values (
    p_eleve_id,
    p_trimestre,
    btrim(p_annee_scolaire),
    jsonb_build_object('matieres', jsonb_build_object(btrim(p_matiere), v_payload)),
    '[]'::jsonb,
    v_moi.id
  )
  on conflict(eleve_id, trimestre, annee_scolaire) do update
     set donnees = jsonb_set(
           coalesce(primaire_bulletins.donnees, '{"matieres":{}}'::jsonb),
           '{matieres}',
           coalesce(primaire_bulletins.donnees->'matieres', '{}'::jsonb)
             || jsonb_build_object(btrim(p_matiere), v_payload),
           true
         ),
         historique = case
           when v_ancien is null then primaire_bulletins.historique
           else coalesce(primaire_bulletins.historique, '[]'::jsonb)
             || jsonb_build_array(jsonb_build_object(
                  'matiere', btrim(p_matiere),
                  'ancienne_valeur', v_ancien,
                  'modifie_par', v_moi.id,
                  'modifie_le', now()
                ))
         end,
         updated_by = v_moi.id,
         updated_at = now()
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'programme', v_programme);
end;
$$;

-- La photo reste celle du dossier d'inscription et de la carte scolaire.
create or replace function public.lire_photos_bulletins_primaire(p_eleve_ids uuid[])
returns table (eleve_id uuid, photo_chemin text, photo_base64 text)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_moi public.users%rowtype;
begin
  select u.* into v_moi
    from public.users u
   where u.auth_user_id = auth.uid() and u.actif = true
   limit 1;
  if v_moi.id is null then
    raise exception 'authentification_requise' using errcode = '42501';
  end if;

  return query
  select e.id, i.photo_chemin,
         case when e.photo_url like 'data:%' then e.photo_url else null end
    from public.eleves e
    join public.classes c on c.id = e.classe_id
    left join public.inscriptions i on i.id = e.inscription_id
   where e.id = any(coalesce(p_eleve_ids, '{}'::uuid[]))
     and e.actif = true
     and c.nom not in ('PS','GS','Petite Section','Grande Section')
     and (
       v_moi.role in ('directeur','responsable_administratif')
       or exists (
         select 1 from public.prof_classes pc
          where pc.user_id = v_moi.id and pc.classe_id = e.classe_id
       )
     );
end;
$$;

create or replace function public.peut_lire_photo_bulletin(p_chemin text)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.users u
      join public.prof_classes pc on pc.user_id = u.id
      join public.eleves e on e.classe_id = pc.classe_id and e.actif = true
      join public.inscriptions i on i.id = e.inscription_id
     where u.auth_user_id = auth.uid() and u.actif = true
       and i.photo_chemin = p_chemin
       and p_chemin like 'photos/%'
  ) or exists (
    select 1 from public.users u
     where u.auth_user_id = auth.uid() and u.actif = true
       and u.role in ('directeur','responsable_administratif')
  );
$$;

drop policy if exists inscriptions_photos_bulletins on storage.objects;
create policy inscriptions_photos_bulletins on storage.objects
  for select to authenticated
  using (
    bucket_id = 'inscriptions'
    and name like 'photos/%'
    and public.peut_lire_photo_bulletin(name)
  );

revoke all on function public.lire_bulletins_primaire(uuid[]) from public, anon;
revoke all on function public.sauver_evaluation_primaire(uuid,text,text,text,jsonb,text) from public, anon;
revoke all on function public.lire_photos_bulletins_primaire(uuid[]) from public, anon;
revoke all on function public.peut_lire_photo_bulletin(text) from public, anon;
grant execute on function public.lire_bulletins_primaire(uuid[]) to authenticated;
grant execute on function public.sauver_evaluation_primaire(uuid,text,text,text,jsonb,text) to authenticated;
grant execute on function public.lire_photos_bulletins_primaire(uuid[]) to authenticated;
grant execute on function public.peut_lire_photo_bulletin(text) to authenticated;

commit;
