-- Workflow officiel d'inscription : dépôt parent -> validation signée direction.
-- À exécuter une fois dans l'éditeur SQL Supabase avant de déployer l'interface.

begin;

alter table public.inscriptions
  add column if not exists signature_directeur_chemin text,
  add column if not exists signature_directeur_nom text,
  add column if not exists signature_directeur_le timestamptz,
  add column if not exists validee_le timestamptz;

-- Ces deux liens manquaient sur la table élèves alors que l'application les
-- utilise pour réunir sans doublon le dossier et l'élève devenu actif.
alter table public.eleves
  add column if not exists inscription_id uuid references public.inscriptions(id) on delete set null,
  add column if not exists matricule text;
create unique index if not exists eleves_inscription_id_unique on public.eleves(inscription_id);
create unique index if not exists eleves_matricule_unique on public.eleves(matricule);

alter table public.inscriptions alter column statut set default 'en_attente';
update public.inscriptions set statut = 'en_attente' where statut is null or statut = 'en_cours';

comment on column public.inscriptions.signature_directeur_chemin is 'Chemin privé Storage de la signature manuscrite du directeur.';
comment on column public.inscriptions.signature_directeur_nom is 'Nom du directeur signataire.';

create or replace function public.valider_inscription_direction(
  p_inscription_id uuid,
  p_signature_chemin text,
  p_directeur_nom text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_ins public.inscriptions%rowtype;
  v_classe_id public.classes.id%type;
  v_parent_phone text;
begin
  if nullif(btrim(coalesce(p_signature_chemin, '')), '') is null then
    raise exception 'signature_direction_requise';
  end if;
  if nullif(btrim(coalesce(p_directeur_nom, '')), '') is null then
    raise exception 'nom_directeur_requis';
  end if;

  select * into v_ins from public.inscriptions where id = p_inscription_id for update;
  if not found then raise exception 'inscription_introuvable'; end if;
  if v_ins.signature_chemin is null then raise exception 'signature_parent_absente'; end if;
  if v_ins.statut = 'validee' then
    return jsonb_build_object('ok', true, 'deja_validee', true, 'matricule', v_ins.matricule);
  end if;

  select id into v_classe_id from public.classes
   where lower(regexp_replace(nom, '\s+bilingue\s*$', '', 'i')) =
         lower(regexp_replace(v_ins.classe_demandee, '\s+bilingue\s*$', '', 'i'))
   order by ordre nulls last limit 1;
  if v_classe_id is null then raise exception 'classe_introuvable' using detail = v_ins.classe_demandee; end if;

  select coalesce(nullif(whatsapp,''), tel1) into v_parent_phone
    from public.responsables where id = v_ins.responsable1_id;

  insert into public.eleves
    (inscription_id, matricule, nom, prenom, sexe, date_naissance, classe_id, parent_phone, actif)
  values
    (v_ins.id, v_ins.matricule, v_ins.nom, v_ins.prenom, v_ins.sexe,
     v_ins.date_naissance, v_classe_id, v_parent_phone, true)
  on conflict (matricule) do update set
    inscription_id = excluded.inscription_id,
    nom = excluded.nom, prenom = excluded.prenom, sexe = excluded.sexe,
    date_naissance = excluded.date_naissance, classe_id = excluded.classe_id,
    parent_phone = excluded.parent_phone, actif = true;

  update public.inscriptions set
    statut = 'validee',
    eleve_id = (select id from public.eleves where matricule = v_ins.matricule),
    signature_directeur_chemin = btrim(p_signature_chemin),
    signature_directeur_nom = btrim(p_directeur_nom),
    signature_directeur_le = now(),
    validee_le = now()
  where id = v_ins.id;

  return jsonb_build_object('ok', true, 'matricule', v_ins.matricule, 'telephone_parent', v_parent_phone);
end;
$function$;

grant execute on function public.valider_inscription_direction(uuid,text,text) to anon, authenticated;

commit;
