-- ═══════════════════════════════════════════════════════════════════════════
-- P0.1 · LA NOTIFICATION DE DÉPÔT PASSE CÔTÉ SERVEUR
-- ═══════════════════════════════════════════════════════════════════════════
--
-- NE PAS EXÉCUTER AVANT VALIDATION EXPLICITE.
--
-- ── Ce que ce script change, et rien d'autre ──────────────────────────────
--
-- Une seule fonction est redéfinie : `creer_inscription_avec_suivi`. Son
-- corps actuel est repris À L'IDENTIQUE — création du dossier, révocation de
-- l'ancien lien de suivi, tirage du jeton, insertion du nouveau lien, retour
-- inchangé. Il n'y a qu'un AJOUT : l'émission de la notification de dépôt.
--
-- Aucune table n'est créée. Aucune policy n'est touchée. Aucun droit n'est
-- élargi. `lire_suivi_inscription`, le QR de la carte scolaire et
-- `public/fiche.html` ne sont pas concernés.
--
-- ── Pourquoi côté serveur ─────────────────────────────────────────────────
--
-- `public/inscription.html` écrivait elle-même la boîte de la direction : elle
-- la lisait, puis la réécrivait entière, sans session — donc avec la clé
-- publique que porte le navigateur de n'importe quel visiteur. C'était
-- l'unique raison de laisser `app_state` ouverte à `anon` EN ÉCRITURE, et donc
-- l'unique raison pour laquelle la grille des salaires y était modifiable par
-- quiconque.
--
-- L'alternative écartée était une RPC `notifier_inscription(p_inscription_id)`
-- exposée à `anon`. Elle est indéfendable : `anon` n'a aucune identité à
-- recouper, la fonction ne pourrait donc pas vérifier que le dossier est bien
-- celui du déposant ; rien ne bornerait le nombre d'appels ; et elle
-- deviendrait un oracle d'existence — identifiant valide, succès ; invalide,
-- erreur.
--
-- Ici, la fonction ne notifie que l'inscription QU'ELLE VIENT DE CRÉER. Le
-- navigateur n'a jamais l'occasion d'en nommer une autre.
--
-- ── Destinataires ─────────────────────────────────────────────────────────
--
-- Identiques à ceux d'aujourd'hui : `directeur` et
-- `responsable_administratif`. Ce ne sont pas les mêmes que pour les
-- préparations : une inscription est un acte administratif, la notification
-- porte `tabTarget = 'eleves'`, et cet onglet EXISTE chez le responsable
-- administratif (`DirecteurApp.jsx` : sessions `eleves`, `rh`, `compta`). Rien
-- ne justifie de l'en retirer.
--
-- ── Verrou ────────────────────────────────────────────────────────────────
--
-- `pg_advisory_xact_lock` sur chaque boîte, comme `notifier_preparation`.
-- Sans lui, deux dépôts à la même minute écraseraient l'une l'autre : c'est
-- exactement la perte que la primitive `etatPartage.js` supprime côté
-- navigateur, et le serveur ne doit pas la réintroduire.

begin;

create or replace function public.creer_inscription_avec_suivi(p_dossier jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $function$
declare
  v_resultat       jsonb;
  v_inscription_id uuid;
  v_token          text;
  -- Ajouts de ce script, et eux seuls.
  v_eleve          jsonb;
  v_notif          jsonb;
  v_cle            text;
  v_liste          jsonb;
  v_reste          jsonb;
  v_titre          text;
  v_message        text;
  v_url            text;
  v_cibles         text[] := array['directeur', 'responsable_administratif'];
begin
  -- ── Inchangé : le workflow validé reste la source unique de création ────
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

  -- ── AJOUT : la notification de dépôt ────────────────────────────────────
  v_eleve := coalesce(p_dossier -> 'eleve', '{}'::jsonb);

  v_titre := '✍️ Inscription à vérifier et signer : '
          || btrim(coalesce(v_eleve ->> 'prenom', '') || ' ' || coalesce(v_eleve ->> 'nom', ''));
  v_message := 'Dossier ' || coalesce(v_resultat ->> 'matricule', '?')
            || ' — ' || coalesce(nullif(btrim(coalesce(v_eleve ->> 'classe_demandee', '')), ''), 'Classe N/A')
            || ' — signature de la Direction requise';
  v_url := '/?notificationTab=eleves&notificationRef=' || v_inscription_id::text;

  -- Identifiant DÉTERMINISTE. Rejouer la notification pour la même inscription
  -- ne peut pas en produire une seconde : l'homonyme est retiré avant l'ajout.
  v_notif := jsonb_build_object(
    'id',        'insc-' || v_inscription_id::text,
    'titre',     v_titre,
    'message',   v_message,
    'date',      to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'lu',        false,
    'type',      'inscription',
    'tabTarget', 'eleves',
    'ref',       v_inscription_id::text
  );

  foreach v_cle in array v_cibles loop
    v_cle := 'notifs_' || v_cle;

    -- Sérialise deux dépôts simultanés sur la MÊME boîte. Sans ce verrou,
    -- deux lectures concurrentes de la liste s'écraseraient.
    perform pg_advisory_xact_lock(hashtext('app_state:notifications:' || v_cle)::bigint);

    select a.value into v_liste
      from public.app_state a
     where a.app = 'notifications' and a.key = v_cle;

    if jsonb_typeof(coalesce(v_liste, 'null'::jsonb)) is distinct from 'array' then
      v_liste := '[]'::jsonb;
    end if;

    -- 49 conservées + la nouvelle = 50, la borne qu'applique déjà la cloche.
    select coalesce(jsonb_agg(e), '[]'::jsonb) into v_reste
      from (
        select e from jsonb_array_elements(v_liste) e
         where e ->> 'id' is distinct from (v_notif ->> 'id')
         limit 49
      ) t;

    insert into public.app_state(app, key, value, updated_at)
    values ('notifications', v_cle, jsonb_build_array(v_notif) || v_reste, now())
    on conflict (app, key) do update
       set value = excluded.value, updated_at = excluded.updated_at;
  end loop;

  -- Web Push : la direction est avertie même application fermée. `perform`
  -- et non `select` — le retour ne nous intéresse pas, et une file de push
  -- indisponible ne doit pas annuler une inscription déjà enregistrée.
  begin
    perform public.emettre_notification_push(
      v_cibles, v_titre, v_message, v_url,
      'ideal-inscription-' || v_inscription_id::text
    );
  exception when others then
    -- Le dossier EST créé et la cloche EST écrite. Faire échouer la
    -- transaction ici perdrait l'inscription pour une notification.
    raise warning 'web push inscription non mis en file : %', sqlerrm;
  end;

  -- ── Inchangé : le jeton brut ne sort qu'ici, une fois ────────────────────
  -- Aucun champ supplémentaire n'est ajouté au retour.
  return v_resultat || jsonb_build_object('suivi_token', v_token);
end;
$function$;

-- Droits INCHANGÉS. Rappelés pour que la redéfinition ne les perde pas.
revoke all on function public.creer_inscription_avec_suivi(jsonb) from public, anon, authenticated;
grant execute on function public.creer_inscription_avec_suivi(jsonb) to anon, authenticated;

-- ── CONTRÔLES AVANT COMMIT ────────────────────────────────────────────────
do $$
declare v_src text;
begin
  select p.prosrc into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'creer_inscription_avec_suivi';

  if strpos(v_src, 'pg_advisory_xact_lock') = 0 then
    raise exception 'LE VERROU MANQUE — deux depots simultanes s ecraseraient';
  end if;
  if strpos(v_src, 'insc-') = 0 then
    raise exception 'IDENTIFIANT NON DETERMINISTE — l idempotence n est pas garantie';
  end if;
  if strpos(v_src, 'creer_inscription(p_dossier)') = 0 then
    raise exception 'LE WORKFLOW DE CREATION A ETE PERDU';
  end if;
end $$;

commit;

-- ── ATTENDU APRÈS EXÉCUTION ───────────────────────────────────────────────
--
--   1. Déposer un dossier de test depuis /inscription.html, non connecté.
--   2. Le matricule et le QR de suivi s'affichent comme avant.
--   3. Exactement UNE entrée `insc-<id>` dans chacune des deux boîtes :
--
--        select key, jsonb_array_length(value) as total,
--               (select count(*) from jsonb_array_elements(value) e
--                 where e->>'type' = 'inscription') as inscriptions
--          from public.app_state
--         where app = 'notifications'
--           and key in ('notifs_directeur','notifs_responsable_administratif');
--
--   4. Aucune entrée en double pour le même identifiant :
--
--        select key, e->>'id' as id, count(*)
--          from public.app_state, jsonb_array_elements(value) e
--         where app = 'notifications' group by 1,2 having count(*) > 1;
--        -- ATTENDU : zéro ligne.
