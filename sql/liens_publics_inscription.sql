-- LOOP 2 · Lien public de suivi d'inscription, distinct du QR carte scolaire.
-- PRÉREQUIS : extension pgcrypto disponible dans le schéma `extensions`.
-- Ne pas exécuter avant validation explicite de ce script.

begin;

create table public.liens_publics_inscription (
  id              uuid primary key default pg_catalog.gen_random_uuid(),
  inscription_id  uuid not null references public.inscriptions(id) on delete cascade,
  type_lien       text not null,
  token_hash      bytea not null,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz,
  revoked_at      timestamptz,
  constraint liens_publics_inscription_type_chk
    check (type_lien in ('SUIVI', 'FICHE_DEFINITIVE')),
  constraint liens_publics_inscription_hash_chk
    check (octet_length(token_hash) = 32),
  constraint liens_publics_inscription_expiration_chk
    check (expires_at is null or expires_at > created_at),
  constraint liens_publics_inscription_revocation_chk
    check (revoked_at is null or revoked_at >= created_at),
  constraint liens_publics_inscription_hash_unique unique (token_hash)
);

create unique index liens_publics_inscription_actif_unique
  on public.liens_publics_inscription(inscription_id, type_lien)
  where revoked_at is null;

create index liens_publics_inscription_inscription_idx
  on public.liens_publics_inscription(inscription_id);

alter table public.liens_publics_inscription enable row level security;

-- Aucune policy : ni anon ni authenticated ne lisent directement les hashes.
revoke all on table public.liens_publics_inscription from public, anon, authenticated;

create or replace function public.creer_inscription_avec_suivi(p_dossier jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $function$
declare
  v_resultat jsonb;
  v_inscription_id uuid;
  v_token text;
begin
  -- Le workflow validé reste la source unique de création du dossier.
  v_resultat := public.creer_inscription(p_dossier);
  if coalesce((v_resultat ->> 'ok')::boolean, false) is not true then
    raise exception 'creation_inscription_non_confirmee';
  end if;

  v_inscription_id := nullif(v_resultat ->> 'inscription_id', '')::uuid;
  if v_inscription_id is null then
    raise exception 'inscription_id_absent';
  end if;

  -- 256 bits aléatoires. Le brut ne sera ni stocké ni journalisé.
  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  update public.liens_publics_inscription
     set revoked_at = now()
   where inscription_id = v_inscription_id
     and type_lien = 'SUIVI'
     and revoked_at is null;

  insert into public.liens_publics_inscription(inscription_id, type_lien, token_hash)
  values (
    v_inscription_id,
    'SUIVI',
    extensions.digest(convert_to(v_token, 'UTF8'), 'sha256')
  );

  -- Le token brut ne sort qu'ici, une fois, vers le parent qui vient de créer
  -- le dossier. Il ne figure dans aucune table.
  return v_resultat || jsonb_build_object('suivi_token', v_token);
end;
$function$;

create or replace function public.lire_suivi_inscription(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $function$
declare
  v_ins public.inscriptions%rowtype;
begin
  -- Même réponse neutre pour token absent, mal formé, inconnu, expiré ou
  -- révoqué : aucune information ne permet d'énumérer les dossiers.
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false);
  end if;

  select i.* into v_ins
    from public.liens_publics_inscription l
    join public.inscriptions i on i.id = l.inscription_id
   where l.type_lien = 'SUIVI'
     and l.token_hash = extensions.digest(convert_to(p_token, 'UTF8'), 'sha256')
     and l.revoked_at is null
     and (l.expires_at is null or l.expires_at > now())
   limit 1;

  if not found then
    return jsonb_build_object('ok', false);
  end if;

  return jsonb_build_object(
    'ok', true,
    'prenom', v_ins.prenom,
    'nom', v_ins.nom,
    'classe_demandee', v_ins.classe_demandee,
    'annee_scolaire', v_ins.annee_scolaire,
    'matricule', v_ins.matricule,
    'date_depot', v_ins.created_at,
    'statut', v_ins.statut,
    'statut_public', case
      when v_ins.statut = 'validee' then 'Inscription validée'
      else 'Dossier reçu — en cours de traitement'
    end
  );
end;
$function$;

revoke all on function public.creer_inscription_avec_suivi(jsonb) from public, anon, authenticated;
revoke all on function public.lire_suivi_inscription(text) from public, anon, authenticated;

grant execute on function public.creer_inscription_avec_suivi(jsonb) to anon, authenticated;
grant execute on function public.lire_suivi_inscription(text) to anon, authenticated;

commit;
