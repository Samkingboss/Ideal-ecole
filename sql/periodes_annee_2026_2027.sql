-- ═══════════════════════════════════════════════════════════════════════
-- TABLE `periodes` — DEDOUBLONNER, VERROUILLER, PEUPLER L ANNEE EN COURS
-- ═══════════════════════════════════════════════════════════════════════
--
-- ── Ce qui a ete mesure, le 25/08/2026 ────────────────────────────────
--
--   15 lignes = 5 periodes x 3 exemplaires STRICTEMENT identiques
--   toutes en annee_scolaire = '2024-2025', bornes 2024-10-01 -> 2025-07-11
--
--   3x ordre=1  1er Trimestre     3x ordre=4  Periode Extra 1
--   3x ordre=2  2eme Trimestre    3x ordre=5  Periode Extra 2
--   3x ordre=3  3eme Trimestre
--
-- Ce ne sont pas des variantes par classe ou par niveau : la table n a ni
-- `classe_id` ni `niveau`. Ses six colonnes sont id, nom, date_debut,
-- date_fin, ordre, annee_scolaire. C est un seed passe trois fois, sans
-- contrainte d unicite pour l en empecher.
--
-- Consequence a l ecran : la liste deroulante affiche « 1er Trimestre »
-- trois fois. Le code filtre desormais l affichage, mais un filtre n est
-- pas un correctif -- les ecritures futures continueraient de pointer sur
-- un clone au hasard.
--
-- Consequence de fond : l annee en cours est 2026-2027. AUCUNE ligne ne la
-- couvre. La periode d un devoir se calcule donc aujourd hui sur un
-- calendrier de repli ecrit dans le code (src/lib/periodeScolaire.js), qui
-- reprend celui deja affiche par l agenda. Ce repli disparait des que ces
-- lignes existent.
--
-- ── Ce que ce script NE fait PAS ──────────────────────────────────────
--
-- Il ne touche pas aux trimestres de src/lib/points.js : ce sont les bornes
-- de la prime d ete, un arbitrage de direction, pas une donnee pedagogique.
-- Il ne supprime pas l annee 2024-2025 : elle reste consultable.
--
-- TRANSACTIONNEL · IDEMPOTENT · REVERSIBLE (sql/periodes_rollback.sql)

begin;

-- ── 1. Dedoublonner en gardant l id DEJA REFERENCE ────────────────────
--
-- Sept `checkpoints` et une `planification` pointent sur un clone precis.
-- Garder « le plus petit id » les rendrait orphelins. Le survivant est donc
-- celui que quelque chose designe deja ; a defaut seulement, le plus petit.
with garde as (
  select distinct on (annee_scolaire, ordre) id
    from public.periodes
   order by annee_scolaire, ordre,
            (exists (select 1 from public.checkpoints    c where c.periode_id = periodes.id)
          or exists (select 1 from public.planifications p where p.periode_id = periodes.id)) desc,
            id
)
delete from public.periodes p where p.id not in (select id from garde);

-- ── 2. Empecher le seed de se rejouer ─────────────────────────────────
create unique index if not exists periodes_annee_ordre_unique
  on public.periodes (annee_scolaire, ordre);

-- ── 3. L annee 2026-2027, alignee sur le calendrier deja affiche ──────
--
-- Ces bornes sont celles de AgendaCalendrier.jsx, en ligne depuis le debut :
-- on ne cree pas un calendrier, on ecrit celui qui fait deja foi a l ecran.
insert into public.periodes (nom, date_debut, date_fin, ordre, annee_scolaire) values
  ('Période 1 (T1)', '2026-10-01', '2026-11-13', 1, '2026-2027'),
  ('Période 2 (T1)', '2026-11-23', '2026-12-18', 2, '2026-2027'),
  ('Période 3 (T2)', '2027-01-04', '2027-02-19', 3, '2026-2027'),
  ('Période 4 (T2)', '2027-03-01', '2027-04-16', 4, '2026-2027'),
  ('Période 5 (T3)', '2027-04-26', '2027-06-25', 5, '2026-2027')
on conflict (annee_scolaire, ordre) do nothing;

-- ── Controle AVANT commit ─────────────────────────────────────────────
do $verif$
declare n integer;
begin
  select count(*) into n from (
    select 1 from public.periodes group by annee_scolaire, ordre having count(*) > 1
  ) x;
  if n > 0 then raise exception 'DOUBLONS RESTANTS : % couple(s) (annee, ordre)', n; end if;

  select count(*) into n from public.periodes where annee_scolaire = '2026-2027';
  if n <> 5 then raise exception 'ANNEE 2026-2027 INCOMPLETE : % periode(s) au lieu de 5', n; end if;

  -- Le point qui compte : aucune reference ne doit etre devenue orpheline.
  select count(*) into n from public.checkpoints c
   where c.periode_id is not null
     and not exists (select 1 from public.periodes p where p.id = c.periode_id);
  if n > 0 then raise exception 'ORPHELINS : % checkpoint(s) pointent dans le vide', n; end if;

  select count(*) into n from public.planifications pl
   where pl.periode_id is not null
     and not exists (select 1 from public.periodes p where p.id = pl.periode_id);
  if n > 0 then raise exception 'ORPHELINS : % planification(s) pointent dans le vide', n; end if;
end
$verif$;

commit;


-- ── Verification apres commit ─────────────────────────────────────────
-- ATTENDU : 2024-2025 -> 5   ·   2026-2027 -> 5
select annee_scolaire, count(*) as periodes,
       min(date_debut) as debut, max(date_fin) as fin
  from public.periodes group by annee_scolaire order by annee_scolaire;

-- ATTENDU : 0 ligne
select annee_scolaire, ordre, count(*)
  from public.periodes group by annee_scolaire, ordre having count(*) > 1;

-- ATTENDU : orphelins = 0
select
  (select count(*) from public.checkpoints c where c.periode_id is not null
     and not exists (select 1 from public.periodes p where p.id = c.periode_id)) as checkpoints_orphelins,
  (select count(*) from public.planifications pl where pl.periode_id is not null
     and not exists (select 1 from public.periodes p where p.id = pl.periode_id)) as planifications_orphelines;
