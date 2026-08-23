-- ═══════════════════════════════════════════════════════════════════════
-- PHASE 1 — ÉTAPE 2 : LES FONCTIONS DE LA CHAÎNE
-- ═══════════════════════════════════════════════════════════════════════
--
-- À exécuter après `phase1_1_fiche_alimentaire.sql`.
--
-- Quatre fonctions, une par maillon du §14 :
--   valider_fiche_alimentaire   — le maillon humain qui transforme une
--                                 déclaration en information exploitable
--   analyser_menu_alimentaire   — la comparaison menu / restrictions
--   effectif_cantine_du_jour    — les présences alimentent la cantine
--   valider_inscription_direction — complétée pour transporter la déclaration
--
-- NON DESTRUCTIF. Le retour arrière consiste à supprimer les trois nouvelles
-- fonctions et à restaurer la précédente version de la quatrième.

begin;

-- ═══════════════════════════════════════════════════════════════════════
-- 1 · VALIDER UNE FICHE ALIMENTAIRE
-- ═══════════════════════════════════════════════════════════════════════
--
-- D1 : le texte libre du parent est une déclaration. Une personne nommée la
-- convertit en information structurée. « RAS » n'est pas une absence
-- d'allergie constatée — c'est une phrase.
--
-- Comme les autres RPC de la plateforme, celle-ci ne peut pas vérifier son
-- appelant tant que l'authentification serveur n'existe pas. Elle exige donc
-- un validateur nommé et vérifie qu'il correspond à un compte actif : c'est
-- une garantie de forme, pas d'identité, et le journal le dit.

create or replace function public.valider_fiche_alimentaire(
  p_eleve_id     uuid,
  p_statut       text,
  p_allergies    jsonb   default '[]'::jsonb,
  p_restrictions jsonb   default '[]'::jsonb,
  p_notes        text    default null,
  p_valide_par   uuid    default null,
  p_cantine      boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_avant  public.eleves%rowtype;
  v_code   text;
begin
  if p_eleve_id is null then
    raise exception 'eleve_manquant';
  end if;

  select * into v_avant from public.eleves where id = p_eleve_id;
  if not found then
    raise exception 'eleve_introuvable';
  end if;

  if p_statut not in ('non_validee','validee_sans_allergie','validee_avec_allergies') then
    raise exception 'statut_invalide' using detail = p_statut;
  end if;

  -- Une validation sans validateur nommé n'a aucune valeur : c'est
  -- précisément ce que D1 exige d'empêcher.
  if p_statut <> 'non_validee' then
    if p_valide_par is null then
      raise exception 'validateur_requis'
        using detail = 'Une fiche validee doit porter le nom de la personne qui l''a validee.';
    end if;
    if not exists (select 1 from public.users where id = p_valide_par and actif = true) then
      raise exception 'validateur_inconnu';
    end if;
  end if;

  -- Chaque code doit exister au référentiel. Un allergène mal orthographié
  -- ne serait jamais retrouvé au balayage des menus : il faut le refuser à
  -- la saisie plutôt que de le laisser passer inerte.
  for v_code in select jsonb_array_elements_text(coalesce(p_allergies,'[]'::jsonb))
                union all
                select jsonb_array_elements_text(coalesce(p_restrictions,'[]'::jsonb))
  loop
    if not exists (select 1 from public.allergenes where code = v_code and actif) then
      raise exception 'allergene_inconnu'
        using detail = format('« %s » n''existe pas au referentiel. Utiliser notes_alimentaires pour un cas non liste.', v_code);
    end if;
  end loop;

  update public.eleves
     set allergies_connues         = coalesce(p_allergies,    '[]'::jsonb),
         restrictions_alimentaires = coalesce(p_restrictions, '[]'::jsonb),
         notes_alimentaires        = nullif(btrim(coalesce(p_notes,'')), ''),
         fiche_alim_statut         = p_statut,
         fiche_alim_validee_par    = case when p_statut = 'non_validee' then null else p_valide_par end,
         fiche_alim_validee_le     = case when p_statut = 'non_validee' then null else now() end,
         cantine                   = coalesce(p_cantine, cantine)
   where id = p_eleve_id;

  -- V2.1 §18 : une correction sensible conserve ancienne valeur, nouvelle,
  -- auteur et objet. Une fiche alimentaire est une donnée sensible.
  insert into public.journal_audit
    (table_cible, ligne_id, champ, ancienne_valeur, nouvelle_valeur,
     auteur_id, auteur_nom, action)
  values
    ('eleves', p_eleve_id::text, 'fiche_alimentaire',
     format('statut=%s allergies=%s restrictions=%s',
            v_avant.fiche_alim_statut, v_avant.allergies_connues, v_avant.restrictions_alimentaires),
     format('statut=%s allergies=%s restrictions=%s',
            p_statut, coalesce(p_allergies,'[]'::jsonb), coalesce(p_restrictions,'[]'::jsonb)),
     p_valide_par,
     coalesce((select prenom || ' ' || nom from public.users where id = p_valide_par),
              'acteur non authentifie (phase 1)'),
     'validation_fiche_alimentaire');

  return jsonb_build_object('ok', true, 'eleve_id', p_eleve_id, 'statut', p_statut);
end;
$function$;

-- Retire les accents sans dépendre de l'extension `unaccent`, qui n'est pas
-- garantie sur l'instance. Suffisant pour le français : le balayage compare
-- « pâtes » et « pates », « bœuf » et « boeuf ».
create or replace function public.unaccent_simple(p text)
returns text language sql immutable as $function$
  select translate(lower(coalesce(p,'')),
                   'àâäáãçéèêëíìîïñóòôöõúùûüýÿœæ',
                   'aaaaaceeeeiiiinooooouuuuyyea');
$function$;

-- ═══════════════════════════════════════════════════════════════════════
-- 2 · COMPARER UN MENU AUX RESTRICTIONS — le cœur du §14
-- ═══════════════════════════════════════════════════════════════════════
--
-- « Lors de la création d'un menu, le système compare les ingrédients aux
-- restrictions alimentaires des enfants concernés. Une incompatibilité
-- produit une alerte AVANT validation. »
--
-- Les menus n'ont pas d'ingrédients structurés : `platTitre` et `platDesc`
-- sont des phrases libres. On balaie donc ces phrases avec les motifs du
-- référentiel. C'est imparfait — et c'est pourquoi la fonction ne conclut
-- jamais « compatible » : elle signale ce qu'elle trouve, et signale aussi
-- ce qu'elle ne peut pas garantir.
--
-- Trois niveaux, du plus grave au plus discret :
--   conflit               un allergène validé apparaît dans un plat
--   fiche_non_validee     on ne peut rien conclure pour cet enfant
--   cantine_indeterminee  on ignore si l'enfant mange à la cantine
--
-- Un enfant sans conflit ET dont la fiche est validée ne produit aucune
-- ligne : l'absence de ligne est le seul « tout va bien » du dispositif.

create or replace function public.analyser_menu_alimentaire(p_plats jsonb)
returns table (
  niveau      text,
  eleve_id    uuid,
  nom         text,
  prenom      text,
  classe      text,
  jour        text,
  plat        text,
  allergene   text,
  motif       text
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if p_plats is null or jsonb_typeof(p_plats) <> 'array' then
    raise exception 'plats_invalides'
      using detail = 'Attendu : [{"jour":"Lundi","plat":"...","texte":"..."}]';
  end if;

  return query
  -- ── conflits avérés ──────────────────────────────────────────────────
  select 'conflit'::text,
         e.id, e.nom, e.prenom, coalesce(c.nom,'—'),
         d.jour, d.plat, a.libelle, m.motif
    from public.eleves e
    left join public.classes c on c.id = e.classe_id
    cross join lateral (
      select p ->> 'jour' as jour, p ->> 'plat' as plat,
             lower(unaccent_simple(coalesce(p ->> 'texte', p ->> 'plat', ''))) as texte
        from jsonb_array_elements(p_plats) p
    ) d
    join public.allergenes a
      on a.actif
     and (e.allergies_connues ? a.code or e.restrictions_alimentaires ? a.code)
    cross join lateral unnest(a.motifs) as m(motif)
   where e.actif
     and e.cantine is not false
     and e.fiche_alim_statut <> 'non_validee'
     and d.texte like '%' || lower(unaccent_simple(m.motif)) || '%'

  union all
  -- ── fiches non validées : on ne peut rien affirmer ───────────────────
  select 'fiche_non_validee'::text,
         e.id, e.nom, e.prenom, coalesce(c.nom,'—'),
         null, null, null, null
    from public.eleves e
    left join public.classes c on c.id = e.classe_id
   where e.actif
     and e.cantine is not false
     and e.fiche_alim_statut = 'non_validee'

  union all
  -- ── inscription cantine inconnue : l'enfant est peut-être à table ────
  select 'cantine_indeterminee'::text,
         e.id, e.nom, e.prenom, coalesce(c.nom,'—'),
         null, null, null, null
    from public.eleves e
    left join public.classes c on c.id = e.classe_id
   where e.actif
     and e.cantine is null
     and e.fiche_alim_statut <> 'non_validee';
end;
$function$;

-- ═══════════════════════════════════════════════════════════════════════
-- 3 · EFFECTIF DU JOUR — §14 et §7
-- ═══════════════════════════════════════════════════════════════════════
--
-- « Les présences officielles du conseiller alimentent automatiquement
-- l'effectif du jour de la cantine. »
--
-- Le registre du conseiller fait foi (§7). En son absence pour une date,
-- la fonction ne devine pas : elle renvoie l'effectif inscrit et dit
-- explicitement que les présences manquent.

create or replace function public.effectif_cantine_du_jour(p_date date default current_date)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select jsonb_build_object(
    'date',                   p_date,
    'inscrits_cantine',       count(*) filter (where e.cantine is true),
    'cantine_indeterminee',   count(*) filter (where e.cantine is null),
    'presents_et_cantine',    count(*) filter (where e.cantine is true and pr.statut is not null and pr.statut <> 'absent'),
    'presences_saisies',      count(pr.id),
    'source_presences',       case when count(pr.id) = 0
                                   then 'aucune presence saisie pour cette date'
                                   else 'registre du conseiller' end,
    'fiches_non_validees',    count(*) filter (where e.cantine is not false and e.fiche_alim_statut = 'non_validee')
  )
  from public.eleves e
  left join public.presences_eleves pr
    on pr.eleve_id = e.id and pr.date_jour = p_date
  where e.actif;
$function$;

-- ═══════════════════════════════════════════════════════════════════════
-- 4 · L'INSCRIPTION TRANSPORTE LA DÉCLARATION — §5
-- ═══════════════════════════════════════════════════════════════════════
--
-- « Si l'enfant est inscrit à la cantine, les informations alimentaires
-- utiles sont transmises automatiquement à la cuisinière. »
--
-- La validation d'inscription recopie donc la déclaration du parent et
-- l'inscription cantine sur le dossier élève. Elle ne valide RIEN : le
-- statut reste `non_validee`, conformément à D1. Le maillon humain reste
-- obligatoire, mais il a désormais la matière sous les yeux.

create or replace function public.valider_inscription_direction(
  p_inscription_id   uuid,
  p_signature_chemin text,
  p_directeur_nom    text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_ins          public.inscriptions%rowtype;
  v_classe_id    public.classes.id%type;
  v_parent_phone text;
  v_eleve_id     uuid;
  v_declaration  text;
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
  if v_classe_id is null then
    raise exception 'classe_introuvable' using detail = v_ins.classe_demandee;
  end if;

  select coalesce(nullif(whatsapp,''), tel1) into v_parent_phone
    from public.responsables where id = v_ins.responsable1_id;

  -- La déclaration brute du parent, telle qu'il l'a écrite. Jamais
  -- interprétée : « Ras » reste « Ras » et n'efface rien.
  v_declaration := nullif(btrim(
      coalesce('Allergies : '    || nullif(btrim(coalesce(v_ins.allergies,   '')), ''), '') ||
      case when nullif(btrim(coalesce(v_ins.allergies,'')),'') is not null
            and nullif(btrim(coalesce(v_ins.restrictions,'')),'') is not null
           then E'\n' else '' end ||
      coalesce('Restrictions : ' || nullif(btrim(coalesce(v_ins.restrictions,'')), ''), '')
    ), '');

  insert into public.eleves
    (inscription_id, matricule, nom, prenom, sexe, date_naissance, classe_id,
     parent_phone, actif, cantine, declaration_alim_parent, fiche_alim_statut)
  values
    (v_ins.id, v_ins.matricule, v_ins.nom, v_ins.prenom, v_ins.sexe,
     v_ins.date_naissance, v_classe_id, v_parent_phone, true,
     v_ins.cantine, v_declaration, 'non_validee')
  on conflict (matricule) do update set
    inscription_id = excluded.inscription_id,
    nom = excluded.nom, prenom = excluded.prenom, sexe = excluded.sexe,
    date_naissance = excluded.date_naissance, classe_id = excluded.classe_id,
    parent_phone = excluded.parent_phone, actif = true,
    cantine = excluded.cantine,
    declaration_alim_parent = excluded.declaration_alim_parent
  returning id into v_eleve_id;

  update public.inscriptions set
    statut = 'validee',
    eleve_id = v_eleve_id,
    signature_directeur_chemin = btrim(p_signature_chemin),
    signature_directeur_nom = btrim(p_directeur_nom),
    signature_directeur_le = now(),
    validee_le = now()
  where id = v_ins.id;

  return jsonb_build_object(
    'ok', true,
    'matricule', v_ins.matricule,
    'eleve_id', v_eleve_id,
    'telephone_parent', v_parent_phone,
    'fiche_alimentaire', 'non_validee',
    'cantine', v_ins.cantine
  );
end;
$function$;

-- ── Droits ─────────────────────────────────────────────────────────────
--
-- Accordées à `anon` : il n'y a pas encore d'autre rôle. Limite assumée de
-- la phase 1, levée en phase 3 avec le contrôle de l'appelant.

grant execute on function public.unaccent_simple(text)                                        to anon, authenticated;
grant execute on function public.analyser_menu_alimentaire(jsonb)                              to anon, authenticated;
grant execute on function public.effectif_cantine_du_jour(date)                                to anon, authenticated;
grant execute on function public.valider_fiche_alimentaire(uuid,text,jsonb,jsonb,text,uuid,boolean) to anon, authenticated;
grant execute on function public.valider_inscription_direction(uuid,text,text)                 to anon, authenticated;

commit;


-- ═══════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS
-- ═══════════════════════════════════════════════════════════════════════

-- Les 12 élèves de recette ont une fiche non validée : ils doivent tous
-- remonter, aucun ne doit être silencieusement considéré comme sans risque.
select niveau, count(*) as nb
  from public.analyser_menu_alimentaire(
    '[{"jour":"Lundi","plat":"Spag Bolo","texte":"Pates nappees d une sauce bolognaise a base de viande hachee"}]'::jsonb)
 group by niveau order by niveau;
-- attendu : fiche_non_validee | 12

select public.effectif_cantine_du_jour(current_date);
-- attendu : cantine_indeterminee = 12, fiches_non_validees = 12
