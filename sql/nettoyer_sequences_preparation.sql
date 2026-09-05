-- Nettoyage etroit des sequences devenues obsoletes apres reduction de duree.
-- La sauvegarde complete reste composee de plusieurs operations client : seule
-- cette suppression est transactionnelle.
--
-- La liste d'identifiants vient du diff deja calcule par le formulaire. Le
-- serveur ne lui fait jamais confiance seule : il recoupe le proprietaire issu
-- de auth.uid(), la date, la plage, la matiere et le groupe de l'ancre.

begin;

create or replace function public.nettoyer_sequences_preparation(
  p_ids uuid[],
  p_date_cours date,
  p_sequence_debut smallint,
  p_nb_sequences smallint
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_prof public.users;
  v_ancre public.preparations;
  v_ids uuid[] := coalesce(p_ids, '{}'::uuid[]);
  v_hors_bloc integer := 0;
  v_supprimees jsonb := '[]'::jsonb;
  v_restantes integer := 0;
begin
  select u.* into v_prof
    from public.users u
   where u.auth_user_id = auth.uid()
     and u.actif = true
   limit 1;

  if v_prof.id is null then
    raise exception 'session_non_authentifiee' using errcode = '28000';
  end if;
  if v_prof.role not in ('professeur','directeur','responsable_administratif') then
    raise exception 'nettoyage_reserve_professeur' using errcode = '42501';
  end if;
  if p_nb_sequences < 1 or p_nb_sequences > 6 then
    raise exception 'nombre_sequences_invalide' using errcode = '22023';
  end if;
  if cardinality(v_ids) > 5 then
    raise exception 'trop_de_sequences_a_nettoyer' using errcode = '22023';
  end if;

  select p.* into v_ancre
    from public.preparations p
   where p.user_id = v_prof.id
     and p.date_cours = p_date_cours
     and p.sequence = p_sequence_debut
   limit 1;

  if v_ancre.id is null then
    raise exception 'preparation_ancre_introuvable' using errcode = 'P0002';
  end if;
  if coalesce((v_ancre.contenu->>'nb_sequences')::integer, 1) <> p_nb_sequences then
    raise exception 'duree_ancre_incoherente' using errcode = '22023';
  end if;

  -- Un ID existant qui ne satisfait pas TOUTES les gardes est un appel hors
  -- bloc. Les IDs deja absents sont permis : le retry est idempotent.
  select count(*) into v_hors_bloc
    from public.preparations p
   where p.id = any(v_ids)
     and not (
       p.user_id = v_prof.id
       and p.date_cours = v_ancre.date_cours
       and p.sequence >= p_sequence_debut + p_nb_sequences
       and p.sequence < p_sequence_debut + 6
       and p.matiere is not distinct from v_ancre.matiere
       and p.groupe is not distinct from v_ancre.groupe
     );

  if v_hors_bloc <> 0 then
    raise exception 'sequence_cible_hors_bloc' using errcode = '42501';
  end if;

  with supprimees as (
    delete from public.preparations p
     where p.id = any(v_ids)
       and p.user_id = v_prof.id
       and p.date_cours = v_ancre.date_cours
       and p.sequence >= p_sequence_debut + p_nb_sequences
       and p.sequence < p_sequence_debut + 6
       and p.matiere is not distinct from v_ancre.matiere
       and p.groupe is not distinct from v_ancre.groupe
    returning p.id
  )
  select coalesce(jsonb_agg(id), '[]'::jsonb)
    into v_supprimees
    from supprimees;

  select count(*) into v_restantes
    from public.preparations p
   where p.id = any(v_ids);

  if v_restantes <> 0 then
    raise exception 'sequences_obsoletes_restantes' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'supprimees', v_supprimees,
    'restantes', v_restantes,
    'proprietaire', v_prof.id
  );
end
$function$;

revoke all on function public.nettoyer_sequences_preparation(uuid[], date, smallint, smallint)
  from public, anon;
grant execute on function public.nettoyer_sequences_preparation(uuid[], date, smallint, smallint)
  to authenticated;

commit;
