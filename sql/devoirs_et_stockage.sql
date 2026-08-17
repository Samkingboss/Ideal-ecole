-- Deux stockages séparés : les préparations d'un côté, les devoirs de l'autre.
--
-- Décidé avec le directeur le 17 août 2026. Aujourd'hui tout vit dans un seul
-- bucket « documents », où les préparations sont rangées sous un préfixe et
-- rien d'autre n'a jamais été déposé. Deux usages différents, deux durées de
-- vie différentes, deux publics différents : on les sépare pour de bon.
--
--   preparations — ce que l'enseignant dépose avant son cours. Consulté par
--                  lui et par la direction, conservé pour l'inspection.
--   devoirs      — les exercices donnés aux élèves, photographiés ou scannés.
--                  Consultés par la classe, renouvelés chaque semaine.
--
-- Le script fait trois choses : il crée les deux buckets, il complète la table
-- `devoirs` qui existe mais ne peut rien enregistrer d'utile, et il pose les
-- droits d'accès. Il est rejouable : le relancer ne casse rien.
--
-- À exécuter dans le SQL Editor de Supabase.


-- ── 1. Les deux buckets ──────────────────────────────────────────────────
-- Publics en lecture : les fichiers sont servis par une URL directe, sans
-- session, parce que la plateforme n'a pas d'authentification Supabase — le
-- compte est un simple enregistrement dans `users`. L'écriture, elle, reste
-- encadrée par les règles du § 4.
--
-- La limite de taille protège le forfait gratuit : 5 Mo suffisent largement à
-- une photo de cahier prise au téléphone, et empêchent qu'un PDF de 80 Mo
-- remplisse le quota d'un coup.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('preparations', 'preparations', true, 5242880,
   array['image/jpeg','image/png','image/webp','application/pdf']),
  ('devoirs',      'devoirs',      true, 5242880,
   array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- ── 2. La table devoirs ──────────────────────────────────────────────────
-- Elle existe déjà, avec id, classe_id, matiere, description, date_donne,
-- date_rendu et created_at. Il lui manque tout le reste : qui a donné le
-- devoir, son titre, et le fichier de l'exercice — c'est-à-dire précisément ce
-- que le directeur cherchait.
--
-- `groupe` double `classe_id` volontairement : l'emploi du temps et les
-- préparations raisonnent en groupes (« CP1 », « CE1-CE2 »), la table des
-- classes en identifiants. Sans le groupe, un devoir ne peut pas être relié à
-- la séance qui l'a donné.

alter table public.devoirs
  add column if not exists user_id     uuid references public.users(id),
  add column if not exists titre       text,
  add column if not exists groupe      text,
  add column if not exists fichier_url text,
  add column if not exists fichier_nom text;

-- Un devoir sans intitulé n'apprend rien à personne, mais on ne peut pas
-- l'imposer aux lignes déjà présentes. La table étant vide à ce jour, la
-- contrainte passe sans risque ; le `not valid` la rendrait inutile.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'devoirs_titre_non_vide') then
    alter table public.devoirs
      add constraint devoirs_titre_non_vide
      check (titre is null or length(trim(titre)) > 0);
  end if;
end $$;

create index if not exists devoirs_groupe_date on public.devoirs (groupe, date_rendu desc);
create index if not exists devoirs_user        on public.devoirs (user_id);


-- ── 3. Droits sur la table devoirs ───────────────────────────────────────
-- Même politique que les autres tables de la plateforme : la clé anonyme fait
-- tout, l'écran décide qui voit quoi.
--
-- Attention : ce script n'ouvre pas la suppression, mais il ne la ferme pas
-- non plus. La table portait déjà une politique permissive, créée avant lui et
-- qu'il ne remplace pas — un DELETE passe donc, vérifié le 17 août 2026 sur
-- une ligne de contrôle. Pour la fermer, il faut d'abord lister l'existant :
--
--   select policyname, cmd, roles from pg_policies
--    where schemaname = 'public' and tablename = 'devoirs';
--
-- Sur le stockage en revanche la suppression est bien fermée : aucune
-- politique de DELETE n'est posée au § 4, et un essai renvoie HTTP 400.

alter table public.devoirs enable row level security;

drop policy if exists devoirs_lecture on public.devoirs;
create policy devoirs_lecture on public.devoirs
  for select using (true);

drop policy if exists devoirs_ajout on public.devoirs;
create policy devoirs_ajout on public.devoirs
  for insert with check (true);

drop policy if exists devoirs_maj on public.devoirs;
create policy devoirs_maj on public.devoirs
  for update using (true) with check (true);


-- ── 4. Droits sur les deux buckets ───────────────────────────────────────
-- Lecture ouverte, dépôt ouvert, remplacement ouvert, suppression fermée —
-- pour la même raison qu'au § 3. Chaque politique est nommée par son bucket :
-- sans le filtre `bucket_id`, une règle écrite pour les devoirs ouvrirait
-- aussi les préparations, et l'inverse.

drop policy if exists prep_lecture   on storage.objects;
create policy prep_lecture on storage.objects
  for select using (bucket_id = 'preparations');

drop policy if exists prep_depot     on storage.objects;
create policy prep_depot on storage.objects
  for insert with check (bucket_id = 'preparations');

drop policy if exists prep_remplace  on storage.objects;
create policy prep_remplace on storage.objects
  for update using (bucket_id = 'preparations') with check (bucket_id = 'preparations');

drop policy if exists devoirs_lecture_fichiers on storage.objects;
create policy devoirs_lecture_fichiers on storage.objects
  for select using (bucket_id = 'devoirs');

drop policy if exists devoirs_depot_fichiers on storage.objects;
create policy devoirs_depot_fichiers on storage.objects
  for insert with check (bucket_id = 'devoirs');

drop policy if exists devoirs_remplace_fichiers on storage.objects;
create policy devoirs_remplace_fichiers on storage.objects
  for update using (bucket_id = 'devoirs') with check (bucket_id = 'devoirs');


-- ── 5. Ce que le script ne fait pas ──────────────────────────────────────
-- Il ne déplace pas les quinze anciens dépôts rangés dans « documents ». Ils
-- restent lisibles à leur adresse actuelle, et les lignes de `preparations`
-- qui les désignent continuent de fonctionner. Les déplacer casserait ces
-- liens pour ranger des fichiers de l'année scolaire écoulée : le jeu n'en
-- vaut pas la chandelle.
--
-- Il ne supprime pas le bucket « documents » non plus, pour la même raison.


-- ── Vérification ─────────────────────────────────────────────────────────
-- Doit afficher les deux buckets, puis les colonnes ajoutées.

select id, public, file_size_limit from storage.buckets
 where id in ('preparations','devoirs') order by id;

select column_name, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'devoirs'
 order by ordinal_position;
