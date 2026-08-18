-- Workflow Préparations consolidé — structures de données.
--
-- La fiche de préparation devient le système de référence unique ; le dépôt
-- de fichier n'est plus une voie parallèle mais une pièce jointe facultative.
-- Décidé avec le promoteur le 18 août 2026, après audit et blueprint.
--
-- Ce script n'ajoute que des colonnes et une table. Il ne supprime rien, ne
-- déplace aucune ligne, et ne touche pas aux 17 préparations existantes — leur
-- migration de statut fait l'objet d'un script séparé, exécuté après contrôle.
--
-- À exécuter dans le SQL Editor de Supabase. Rejouable sans risque.
--
--
-- ⚠ DETTE CONNUE — LES POLITIQUES RLS DE CE SCRIPT NE SONT PAS LA SÉCURITÉ
--   FINALE D'IDEAL.
--
-- Les politiques posées plus bas sont en `using (true)` : elles autorisent la
-- lecture et l'écriture à quiconque détient la clé anonyme, laquelle est
-- publique par nature. C'est la situation de toutes les tables de la
-- plateforme aujourd'hui, et c'est une étape de laboratoire assumée — pas un
-- choix de sécurité.
--
-- Le §19 du cahier des charges V2.1 exige des permissions par rôle et par
-- action, appliquées côté serveur. Ce chantier est identifié (P0-4) et doit
-- être conduit avant toute saisie de données familiales réelles. Les
-- politiques de ce script devront alors être reprises comme toutes les autres.
--
-- Ne pas lire ces trois politiques comme les permissions définitives de la
-- table `parametres`.


-- ── 0. Vérifications préalables ──────────────────────────────────────────
-- Ces requêtes n'écrivent rien. Elles affichent l'état d'avant, pour que la
-- comparaison d'après soit possible. PostgREST n'expose ni les index ni les
-- contraintes : ces contrôles ne peuvent se faire qu'ici.

-- 0.a — Les index déjà posés sur `preparations`. Les deux index créés plus bas
--       s'appellent `preparations_status` et `preparations_user_date` ; s'ils
--       figurent déjà dans cette liste, `if not exists` les laissera en place.
select indexname, indexdef
  from pg_indexes
 where schemaname = 'public' and tablename = 'preparations'
 order by indexname;

-- 0.b — Le type de `users.id`, que `parametres.modifie_par` va référencer.
--       Doit afficher « uuid ».
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'users' and column_name = 'id';

-- 0.c — Les 19 colonnes actuelles de `preparations`, avant ajout.
select count(*) as colonnes_avant
  from information_schema.columns
 where table_schema = 'public' and table_name = 'preparations';

-- 0.d — Les 17 préparations et leurs statuts, avant application.
select status, count(*) as lignes
  from public.preparations group by status order by status;


-- ── 1. La table des paramètres d'établissement ───────────────────────────
-- « Le délai de préparation doit être un paramètre métier configurable au
-- niveau de l'établissement, et non une règle codée en dur. »
--
-- Une table plutôt qu'une clé dans `app_state` : les paramètres sont une
-- donnée métier durable, pas un état d'application, et l'inventaire a montré
-- où mène le stockage en blocs JSON. `ecole_id` est prévu dès maintenant,
-- nullable, pour que la duplicabilité multi-écoles du §20 ne coûte pas une
-- migration de plus le jour venu.

create table if not exists public.parametres (
  cle          text primary key,
  valeur       jsonb not null,
  libelle      text,
  description  text,
  ecole_id     uuid,
  modifie_par  uuid references public.users(id),
  modifie_le   timestamptz not null default now()
);

comment on table public.parametres is
  'Paramètres métier configurables par l''administration, sans modification du code.';

-- Le délai de dépôt. La valeur initiale reprend la règle la plus souple des
-- deux qui coexistaient — celle qui alimentait déjà les points — pour ne
-- déclarer en retard aucune préparation qui ne l'était pas hier.
--
-- `heures_avant_cours: 0` signifie « avant le début du cours ».
-- Une valeur de 10 exigerait un dépôt dix heures avant.

insert into public.parametres (cle, valeur, libelle, description)
values (
  'preparations.delai',
  '{"heures_avant_cours": 0, "rappel_avant_heures": 24, "relance_apres_heures": 2}'::jsonb,
  'Délai de dépôt des préparations',
  'heures_avant_cours : combien d''heures avant le cours la préparation est attendue (0 = avant le début du cours). rappel_avant_heures : quand prévenir l''enseignant qu''une préparation manque. relance_apres_heures : au bout de combien de temps signaler le dépassement. Une seule notification par événement.'
)
on conflict (cle) do nothing;   -- ne jamais écraser un réglage de l'administration

alter table public.parametres enable row level security;

drop policy if exists parametres_lecture on public.parametres;
create policy parametres_lecture on public.parametres for select using (true);

drop policy if exists parametres_maj on public.parametres;
create policy parametres_maj on public.parametres for update using (true) with check (true);

drop policy if exists parametres_ajout on public.parametres;
create policy parametres_ajout on public.parametres for insert with check (true);


-- ── 2. Les quatre colonnes manquantes de `preparations` ──────────────────
-- `url_doc` est conservée : elle porte les quinze anciens dépôts, dont les
-- adresses doivent rester valides. Elle recevra désormais la première pièce
-- jointe, pour que tout ce qui la lit continue de fonctionner.

alter table public.preparations
  -- Plusieurs fichiers, ordre préservé : [{url, nom, type, taille}]
  add column if not exists pieces_jointes    jsonb not null default '[]'::jsonb,
  -- « Le système conserve l'historique plutôt que d'écraser silencieusement
  -- les états précédents » : [{statut, le, par, par_nom, action, commentaire}]
  add column if not exists historique_statuts jsonb not null default '[]'::jsonb,
  -- Horodate une modification exceptionnelle après validation.
  --
  -- Recoupement assumé : l'événement `reouverture` figurera aussi dans
  -- `historique_statuts`. Cette colonne ne porte donc aucune information
  -- nouvelle — elle la rend interrogeable. Répondre à « quelles préparations
  -- validées ont été rouvertes ? » exigerait sinon de parcourir le JSON de
  -- chaque ligne. Le tableau de bord et l'audit en ont besoin.
  add column if not exists verrouillee_le    timestamptz,
  -- Appréciations par critère, dont la note découle :
  -- {structure: 'conforme', objectifs: 'a_renforcer', ...}
  add column if not exists appreciations     jsonb;

create index if not exists preparations_status      on public.preparations (status);
create index if not exists preparations_user_date   on public.preparations (user_id, date_cours desc);


-- ── 3. Ce que ce script ne fait pas ──────────────────────────────────────
-- Il ne convertit pas les statuts existants. Les 17 lignes portent aujourd'hui
-- trois vocabulaires — « acceptable » (14), « rejeté (retard) » (1),
-- « depose » (2) — et leur conversion vers la nomenclature validée
-- (Brouillon, Déposée, En retard, À corriger, Validée) se fera par un script
-- dédié, après sauvegarde et avec vérification, comme pour la migration P0-1.
--
-- Il ne touche pas au barème de performance, qui reste expérimental et non
-- validé.


-- ── 4. Retour en arrière ─────────────────────────────────────────────────
--
-- RÈGLE : ne jamais supprimer la table `parametres` dans son ensemble. Elle
-- est conçue pour accueillir les paramètres de toute la plateforme ; au
-- premier réglage enregistré par une autre partie du système, la détruire
-- effacerait le travail d'autrui. Cette règle vaut dès maintenant, et pas
-- seulement le jour où la table sera peuplée.
--
-- Deux situations, deux procédures.
--
-- ── Cas 1 : annulation immédiate, dans la foulée de l'application ────────
-- Recevable uniquement si les contrôles ci-dessous sont négatifs ET
-- qu'aucune donnée métier n'a encore été écrite. Vérifier d'abord :
--
--   select count(*) from public.parametres where cle <> 'preparations.delai';
--   select count(*) from public.preparations
--    where pieces_jointes <> '[]'::jsonb
--       or historique_statuts <> '[]'::jsonb
--       or appreciations is not null
--       or verrouillee_le is not null;
--
-- Si ces deux comptes valent zéro, rien n'a été produit et l'annulation est
-- sans perte :
--
--   alter table public.preparations
--     drop column if exists pieces_jointes,
--     drop column if exists historique_statuts,
--     drop column if exists verrouillee_le,
--     drop column if exists appreciations;
--   delete from public.parametres where cle = 'preparations.delai';
--   -- la table `parametres` reste en place, même vide.
--
-- Si l'un des deux comptes est non nul, on n'est plus dans ce cas : passer
-- au cas 2.
--
-- ── Cas 2 : retour ultérieur, après usage ────────────────────────────────
-- Ne retirer que ce que ce chantier a introduit, et seulement après avoir
-- vérifié ce qui en dépend :
--
--   1. Exporter les colonnes concernées avant toute suppression :
--        select id, pieces_jointes, historique_statuts, appreciations,
--               verrouillee_le
--          from public.preparations
--         where pieces_jointes <> '[]'::jsonb
--            or historique_statuts <> '[]'::jsonb
--            or appreciations is not null;
--
--   2. Recenser les lecteurs de `preparations.delai` — au 18 août 2026,
--      src/lib/preparations.js et lui seul. Vérifier qu'aucun autre code ne
--      l'interroge avant de retirer la ligne.
--
--   3. Ne supprimer QUE la ligne du chantier, jamais la table :
--        delete from public.parametres where cle = 'preparations.delai';
--
--   4. Les quatre colonnes ne se suppriment qu'après export et confirmation
--      qu'aucune préparation ne s'en sert. En cas de doute, les laisser en
--      place : une colonne inutilisée ne coûte rien, une donnée perdue ne se
--      récupère pas — ce forfait Supabase n'a pas de restauration ponctuelle.
--
-- Côté code, `git revert` du commit de la fondation suffit : la bibliothèque
-- n'est importée par aucun écran à ce stade.


-- ── Vérification après application ───────────────────────────────────────

select cle, valeur, libelle from public.parametres where cle = 'preparations.delai';

-- Doit afficher 23 : les 19 colonnes d'origine plus les 4 ajoutées.
select count(*) as colonnes_apres
  from information_schema.columns
 where table_schema = 'public' and table_name = 'preparations';

-- Les 17 préparations, inchangées : mêmes statuts qu'au § 0.d.
select status, count(*) as lignes
  from public.preparations group by status order by status;

-- Aucune donnée produite par ce script : les quatre colonnes sont à leur
-- valeur par défaut sur les 17 lignes.
select count(*) as lignes_touchees
  from public.preparations
 where pieces_jointes <> '[]'::jsonb
    or historique_statuts <> '[]'::jsonb
    or appreciations is not null
    or verrouillee_le is not null;

select column_name, data_type, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'preparations'
   and column_name in ('pieces_jointes','historique_statuts','verrouillee_le','appreciations')
 order by column_name;
