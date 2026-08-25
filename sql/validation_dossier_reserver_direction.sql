-- ═══════════════════════════════════════════════════════════════════════
-- VALIDATION D UN DOSSIER — RESERVER LA FONCTION A LA DIRECTION
-- ═══════════════════════════════════════════════════════════════════════
--
-- ── Le defaut, mesure ─────────────────────────────────────────────────
--
--   POST /rest/v1/rpc/valider_inscription_direction   (cle publiable seule)
--     -> {"code":"P0001","message":"inscription_introuvable"}
--
-- Ce n est pas un refus : c est la logique metier qui repond. La fonction
-- etait `grant execute ... to anon` et ne verifiait aucun droit. Elle est
-- SECURITY DEFINER, donc la RLS ne la protege pas non plus.
--
-- Et l identifiant n est pas un secret : `creer_inscription` rend
-- `inscription_id` au parent qui vient de deposer son dossier. Ce parent
-- tenait donc l identifiant exact du sien. Il pouvait le valider lui-meme :
-- creation de l eleve, attribution du matricule, envoi du WhatsApp. Le
-- chemin de signature passe en argument n est jamais verifie — « x » suffit.
--
-- ── Le correctif ──────────────────────────────────────────────────────
--
-- Deux verrous, volontairement redondants :
--   1. un controle `ideal_est_direction()` en tete de fonction ;
--   2. le retrait du `grant` a `anon`.
-- L un rattrape l oubli de l autre. Un `revoke` seul serait defait par un
-- futur `grant to anon` recopie d un autre fichier.
--
-- Le seul appelant est `InscriptionsValidation.jsx`, ecran de la direction
-- authentifiee : rien de public ne casse.
--
-- TRANSACTIONNEL · IDEMPOTENT (create or replace) · REVERSIBLE (fichier
-- sql/validation_dossier_rollback.sql). Aucune donnee touchee.

begin;

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
  -- ── AUTORISATION ──────────────────────────────────────────────────────
  --
  -- Mesuré le 25/08/2026 : `anon` atteignait cette fonction et recevait
  -- `inscription_introuvable` — donc la logique metier, pas un refus.
  -- Et `creer_inscription` rend `inscription_id` au parent qui vient de
  -- deposer : ce parent tenait l identifiant exact de son propre dossier.
  -- Il pouvait le valider lui-meme, creer l eleve, obtenir un matricule et
  -- declencher le WhatsApp, en passant `p_signature_chemin` = n importe quoi
  -- puisque ce chemin n est jamais verifie.
  --
  -- SECURITY DEFINER retire toute protection par RLS : sans ce controle, le
  -- `grant ... to anon` suffisait. La garde est ici ET le grant est retire :
  -- l un rattrape l oubli de l autre.
  if not public.ideal_est_direction() then
    raise exception 'validation_reservee_direction'
      using hint = 'Seules la direction et le responsable administratif valident un dossier.';
  end if;

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

revoke execute on function public.valider_inscription_direction(uuid,text,text) from anon;
grant  execute on function public.valider_inscription_direction(uuid,text,text) to authenticated;

-- ── Controle AVANT commit ─────────────────────────────────────────────
do $verif$
declare n integer;
begin
  -- 1. `anon` ne doit plus pouvoir executer la fonction.
  if has_function_privilege('anon',
       'public.valider_inscription_direction(uuid,text,text)', 'execute') then
    raise exception 'ANON PEUT ENCORE VALIDER UN DOSSIER';
  end if;

  -- 2. la direction, elle, doit pouvoir.
  if not has_function_privilege('authenticated',
       'public.valider_inscription_direction(uuid,text,text)', 'execute') then
    raise exception 'LA DIRECTION NE PEUT PLUS VALIDER : correctif trop large';
  end if;

  -- 3. la garde doit etre PRESENTE DANS LE CORPS, pas seulement dans ce
  --    fichier. Un `revoke` sans garde interne se defait d un seul `grant`.
  select count(*) into n from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'valider_inscription_direction'
     and p.prosrc like '%ideal_est_direction()%';
  if n < 1 then
    raise exception 'GARDE INTERNE ABSENTE : le corps ne verifie pas ideal_est_direction()';
  end if;
end
$verif$;

commit;


-- ── Verification apres commit ─────────────────────────────────────────
-- ATTENDU : anon = false, authenticated = true, garde_interne = true
select
  has_function_privilege('anon',
    'public.valider_inscription_direction(uuid,text,text)', 'execute') as anon_peut_valider,
  has_function_privilege('authenticated',
    'public.valider_inscription_direction(uuid,text,text)', 'execute') as direction_peut_valider,
  exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
           where ns.nspname='public' and p.proname='valider_inscription_direction'
             and p.prosrc like '%ideal_est_direction()%') as garde_interne;
