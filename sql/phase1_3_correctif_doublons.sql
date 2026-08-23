-- ═══════════════════════════════════════════════════════════════════════
-- PHASE 1 — ÉTAPE 3 : UNE ALERTE PAR CONFLIT RÉEL
-- ═══════════════════════════════════════════════════════════════════════
--
-- Défaut trouvé au test de bout en bout : un plat qui contient plusieurs
-- motifs du même allergène produisait autant de lignes que de motifs.
-- « Spag'Bolo » déclenchait trois alertes pour un seul enfant et un seul
-- bœuf — « viande hachee », « viande hachée » et « bolognaise ».
--
-- Le compteur affiché à la cuisinière annoncerait « 3 alertes » là où il y
-- en a une. Un compteur qui exagère est aussi mauvais qu'un compteur qui
-- minimise : il apprend à ne plus le croire.
--
-- Un `group by` sur (élève, jour, plat, allergène) : une ligne par conflit
-- réel, avec un motif retenu à titre d'explication.
--
-- NON DESTRUCTIF : remplace une fonction, ne touche à aucune donnée.

begin;

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
  -- ── conflits avérés, dédoublonnés ────────────────────────────────────
  --
  -- `group by` plutôt que `distinct on` : ce dernier impose un `order by`,
  -- lequel se rattache à l'UNION entière et non à sa première branche —
  -- d'où un 42601. `min(motif)` retient un motif à titre d'explication.
  select 'conflit'::text,
         e.id, e.nom, e.prenom, coalesce(c.nom,'—'),
         d.jour, d.plat, a.libelle, min(m.motif)
    from public.eleves e
    left join public.classes c on c.id = e.classe_id
    cross join lateral (
      select p ->> 'jour' as jour, p ->> 'plat' as plat,
             lower(public.unaccent_simple(coalesce(p ->> 'texte', p ->> 'plat', ''))) as texte
        from jsonb_array_elements(p_plats) p
    ) d
    join public.allergenes a
      on a.actif
     and (e.allergies_connues ? a.code or e.restrictions_alimentaires ? a.code)
    cross join lateral unnest(a.motifs) as m(motif)
   where e.actif
     and e.cantine is not false
     and e.fiche_alim_statut <> 'non_validee'
     and d.texte like '%' || lower(public.unaccent_simple(m.motif)) || '%'
   group by e.id, e.nom, e.prenom, c.nom, d.jour, d.plat, a.libelle

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

grant execute on function public.analyser_menu_alimentaire(jsonb) to anon, authenticated;

commit;


-- ═══════════════════════════════════════════════════════════════════════
-- VÉRIFICATION
-- ═══════════════════════════════════════════════════════════════════════
-- Le même menu qui produisait trois lignes n'en produit plus qu'une.

select niveau, count(*) as nb
  from public.analyser_menu_alimentaire(
    '[{"jour":"Lundi","plat":"Plat — Spag Bolo","texte":"Pâtes nappées d une sauce bolognaise à base de viande hachée et de tomates"}]'::jsonb)
 group by niveau order by niveau;
-- attendu : conflit | 1  ·  fiche_non_validee | 11
