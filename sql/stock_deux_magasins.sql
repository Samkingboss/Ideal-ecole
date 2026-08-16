-- Deux magasins distincts, un seul mécanisme.
--
-- Décidé avec le directeur le 16 août 2026 : le surveillant tient le matériel
-- pédagogique, la cuisinière tient les denrées et les fluides. Ce sont deux
-- armoires, deux responsables, deux inventaires — mais exactement la même
-- façon de compter, et il n'y avait aucune raison de dupliquer les tables.
--
-- On ajoute donc une colonne `magasin` plutôt que de créer un second jeu de
-- tables : les mouvements, le déclencheur qui recalcule le stock et l'écran
-- d'inventaire servent aux deux sans une ligne de plus.
--
-- À exécuter dans le SQL Editor, après sql/stock_et_sanctions.sql.


-- ── 1. La colonne magasin ────────────────────────────────────────────────
-- Par défaut « pedagogique » : les articles déjà saisis appartiennent au
-- surveillant, c'est le seul magasin qui existait jusqu'ici.

alter table public.materiels
  add column if not exists magasin text not null default 'pedagogique';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'mat_magasin_connu') then
    alter table public.materiels
      add constraint mat_magasin_connu check (magasin in ('pedagogique','cuisine'));
  end if;
end $$;


-- ── 2. L'unicité du nom devient propre à chaque magasin ──────────────────
-- « Savon » peut exister des deux côtés sans que l'un empêche l'autre : ce
-- ne sont pas les mêmes bidons, ni le même responsable.

alter table public.materiels drop constraint if exists mat_nom_unique;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'mat_nom_unique_par_magasin') then
    alter table public.materiels
      add constraint mat_nom_unique_par_magasin unique (magasin, nom);
  end if;
end $$;

create index if not exists mat_magasin_idx on public.materiels (magasin, nom);


-- ── 3. Le garde-manger ───────────────────────────────────────────────────
--
-- Les quatorze denrées nommées par le directeur. Les unités sont proposées,
-- pas imposées : elles se corrigent depuis l'écran de la cuisinière, qui sait
-- mieux que nous si l'huile s'achète au litre ou au bidon.
--
-- Les seuils d'alerte sont volontairement à zéro : personne ne connaît encore
-- la consommation réelle d'une semaine de cantine. Les régler au jugé ferait
-- sonner l'alerte pour rien, ou pas du tout. Ils se règlent article par
-- article une fois qu'on aura vu tourner un mois.
--
-- La quantité reste à zéro : elle s'établit par une réception ou un premier
-- inventaire, jamais par une saisie directe.

insert into public.materiels (nom, unite, magasin, seuil_alerte)
values
  ('Huile',             'litre',   'cuisine', 0),
  ('Riz',               'kg',      'cuisine', 0),
  ('Oignon',            'kg',      'cuisine', 0),
  ('Pomme de terre',    'kg',      'cuisine', 0),
  ('Pâte alimentaire',  'paquet',  'cuisine', 0),
  ('Couscous',          'kg',      'cuisine', 0),
  ('Cube',              'boîte',   'cuisine', 0),
  ('Sel',               'kg',      'cuisine', 0),
  ('Épices',            'sachet',  'cuisine', 0),
  ('Petits pois',       'boîte',   'cuisine', 0),
  ('Biscuits',          'paquet',  'cuisine', 0),
  ('Farine',            'kg',      'cuisine', 0),
  ('Sucre',             'kg',      'cuisine', 0),
  ('Tomate concentrée', 'boîte',   'cuisine', 0)
on conflict (magasin, nom) do nothing;


-- ── 4. Contrôle ──────────────────────────────────────────────────────────
-- Attendu : 14 articles en cuisine, et le pédagogique inchangé.

select magasin, count(*) as articles, sum(quantite) as unites_en_stock
  from public.materiels
 group by magasin
 order by magasin;
