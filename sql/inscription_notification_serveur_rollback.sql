-- ROLLBACK de `sql/inscription_notification_serveur.sql`.
--
-- Rétablit `creer_inscription_avec_suivi` SANS l'émission de notification,
-- c'est-à-dire sa définition d'avant ce script.
--
-- AVERTISSEMENT : ce rollback SEUL ne rétablit pas le comportement d'avant.
-- `public/inscription.html` ne contient plus le code qui écrivait la
-- notification depuis le navigateur. Après ce rollback, un dépôt réussit mais
-- PERSONNE N'EST PRÉVENU. Pour revenir réellement en arrière il faut aussi
-- annuler la modification de la page (`git revert` du commit correspondant).

begin;

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
  v_resultat := public.creer_inscription(p_dossier);
  if coalesce((v_resultat ->> 'ok')::boolean, false) is not true then
    raise exception 'creation_inscription_non_confirmee';
  end if;

  v_inscription_id := nullif(v_resultat ->> 'inscription_id', '')::uuid;
  if v_inscription_id is null then
    raise exception 'inscription_id_absent';
  end if;

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

  return v_resultat || jsonb_build_object('suivi_token', v_token);
end;
$function$;

revoke all on function public.creer_inscription_avec_suivi(jsonb) from public, anon, authenticated;
grant execute on function public.creer_inscription_avec_suivi(jsonb) to anon, authenticated;

commit;
