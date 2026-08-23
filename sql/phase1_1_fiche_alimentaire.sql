-- ═══════════════════════════════════════════════════════════════════════
-- PHASE 1 — ÉTAPE 1 : LA CHAÎNE ALIMENTAIRE
-- ═══════════════════════════════════════════════════════════════════════
--
-- Sources : V2.1 §14 et §5 · décision D1 du 23/08/2026.
--
-- ── Ce que le V2.1 exige, littéralement ────────────────────────────────
--
-- §14 : « À l'inscription, le parent renseigne allergies, restrictions et
-- informations alimentaires importantes. Ces données sont saisies une seule
-- fois et accessibles à la cuisinière. » — « Lors de la création d'un menu,
-- le système compare les ingrédients aux restrictions alimentaires des
-- enfants concernés. Une incompatibilité produit une alerte avant validation
-- et permet de prévoir une alternative. »
--
-- §5 : « Si l'enfant est inscrit à la cantine, les informations alimentaires
-- utiles sont transmises automatiquement à la cuisinière. »
--
-- ── Ce que D1 ajoute ───────────────────────────────────────────────────
--
-- Un état de validation explicite. Une fiche non validée s'affiche
-- « NON VALIDÉE », jamais « Aucune ». Le texte libre du parent — « RAS »,
-- « Ras », vide — n'est jamais interprété comme une absence d'allergie
-- constatée. Le modèle distingue allergies connues, restrictions, notes,
-- statut, validateur et date.
--
-- ── Le principe qui gouverne tout le script ────────────────────────────
--
-- L'inconnu n'est jamais une réponse rassurante. Une fiche sans validation
-- n'est pas « sans allergie ». Un plat sans ingrédient déclaré n'est pas
-- « compatible ». Un enfant dont l'inscription cantine est inconnue n'est
-- pas « non inscrit ». Chaque défaut de ce script va dans le sens de
-- l'alerte, jamais du silence.
--
-- NON DESTRUCTIF : additif uniquement. Aucune colonne supprimée, aucune
-- donnée réécrite. Le retour arrière consiste à révoquer les fonctions ;
-- les colonnes peuvent rester sans nuire.

begin;

-- ═══════════════════════════════════════════════════════════════════════
-- 1 · RÉFÉRENTIEL DES ALLERGÈNES
-- ═══════════════════════════════════════════════════════════════════════
--
-- Le V2.1 ne fixe pas de liste d'allergènes : c'est un dictionnaire de
-- données, pas une règle métier. Il est donc en table, modifiable par la
-- direction, et non codé en dur — R13 réserve les règles au promoteur, mais
-- n'interdit pas d'outiller.
--
-- `motifs` sert au balayage des menus en texte libre. Les menus n'ont
-- aujourd'hui aucun ingrédient structuré : `platTitre` et `platDesc` sont
-- des phrases. Le balayage par motifs est ce qui rend le §14 applicable
-- sans imposer à la cuisinière une ressaisie complète de ses recettes.

create table if not exists public.allergenes (
  code    text primary key,
  libelle text not null,
  motifs  text[] not null default '{}',
  actif   boolean not null default true,
  ordre   integer not null default 100
);

comment on table public.allergenes is
  'Referentiel des allergenes et restrictions. `motifs` sert au balayage des '
  'menus en texte libre (V2.1 §14). Modifiable par la direction : ce n''est '
  'pas une regle metier figee mais un dictionnaire de donnees.';

revoke insert, update, delete on public.allergenes from anon, authenticated;
grant  select                 on public.allergenes to   anon, authenticated;

insert into public.allergenes (code, libelle, motifs, ordre) values
  ('arachide',   'Arachide',            array['arachide','cacahuete','cacahuète','peanut','pate d''arachide','pâte d''arachide','tigadege','tigadègè'], 10),
  ('fruits_coq', 'Fruits à coque',      array['noix','amande','noisette','cajou','pistache','anacarde'], 20),
  ('lactose',    'Lait et lactose',     array['lait','lactose','fromage','beurre','creme','crème','yaourt','yogourt'], 30),
  ('gluten',     'Gluten',              array['ble','blé','gluten','farine','pain','pate','pâte','semoule','couscous','spaghetti','spag'], 40),
  ('oeuf',       'Œuf',                 array['oeuf','œuf','omelette','mayonnaise'], 50),
  ('poisson',    'Poisson',             array['poisson','thon','capitaine','sardine','maquereau','tilapia'], 60),
  ('fruits_mer', 'Fruits de mer',       array['crevette','crabe','fruits de mer','langouste'], 70),
  ('soja',       'Soja',                array['soja','soya','tofu'], 80),
  ('porc',       'Porc',                array['porc','cochon','jambon','lardon','bacon','charcuterie'], 90),
  ('boeuf',      'Bœuf',                array['boeuf','bœuf','viande hachee','viande hachée','bolognaise','steak'], 100),
  ('banane',     'Banane',              array['banane','plantain'], 110),
  ('sesame',     'Sésame',              array['sesame','sésame','tahini'], 120),
  ('vegetarien', 'Régime végétarien',   array['poulet','boeuf','bœuf','porc','viande','poisson','thon','mouton','agneau'], 130)
on conflict (code) do nothing;

-- ═══════════════════════════════════════════════════════════════════════
-- 2 · LA FICHE ALIMENTAIRE SUR LE DOSSIER ÉLÈVE
-- ═══════════════════════════════════════════════════════════════════════
--
-- V2.1 §4 : le dossier élève permanent porte les « informations pertinentes
-- de santé/cantine ». C'est donc `eleves` qui fait foi, pas `inscriptions` —
-- l'inscription est le point d'entrée, le dossier est la source de vérité.

alter table public.eleves
  add column if not exists allergies_connues        jsonb   not null default '[]'::jsonb,
  add column if not exists restrictions_alimentaires jsonb  not null default '[]'::jsonb,
  add column if not exists notes_alimentaires       text,
  add column if not exists declaration_alim_parent  text,
  add column if not exists fiche_alim_statut        text    not null default 'non_validee',
  add column if not exists fiche_alim_validee_par   uuid    references public.users(id),
  add column if not exists fiche_alim_validee_le    timestamptz;

-- Trois états, et le défaut est le plus prudent des trois.
--
-- `validee_sans_allergie` n'est PAS le défaut : c'est une affirmation, et
-- elle exige que quelqu'un l'ait faite. C'est tout l'objet de D1.
alter table public.eleves drop constraint if exists eleves_fiche_alim_statut_check;
alter table public.eleves add constraint eleves_fiche_alim_statut_check
  check (fiche_alim_statut in ('non_validee','validee_sans_allergie','validee_avec_allergies'));

-- Une validation anonyme n'est pas une validation. La base refuse.
alter table public.eleves drop constraint if exists eleves_fiche_alim_validation_check;
alter table public.eleves add constraint eleves_fiche_alim_validation_check
  check (
    fiche_alim_statut = 'non_validee'
    or (fiche_alim_validee_par is not null and fiche_alim_validee_le is not null)
  );

-- Une fiche déclarée « avec allergies » sans aucune allergie ni restriction
-- serait un état incohérent : soit il y a quelque chose, soit c'est l'autre statut.
alter table public.eleves drop constraint if exists eleves_fiche_alim_coherence_check;
alter table public.eleves add constraint eleves_fiche_alim_coherence_check
  check (
    fiche_alim_statut <> 'validee_avec_allergies'
    or jsonb_array_length(allergies_connues) > 0
    or jsonb_array_length(restrictions_alimentaires) > 0
  );

-- Inscription cantine à TROIS états — décision du promoteur, 23/08.
-- NULL = non déterminé. Une inscription inconnue n'est jamais une
-- inscription confirmée : elle doit se voir, pas se deviner.
alter table public.eleves add column if not exists cantine boolean;

comment on column public.eleves.cantine is
  'NULL = non determine · TRUE = inscrit · FALSE = non inscrit. '
  'L''inconnu n''est jamais interprete comme une inscription confirmee.';

comment on column public.eleves.declaration_alim_parent is
  'Texte brut saisi par le parent a l''inscription. Declaration, jamais '
  'validation : ne doit jamais etre affiche comme faisant foi (D1).';

create index if not exists eleves_cantine_idx on public.eleves(cantine) where cantine is true;

commit;


-- ═══════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS
-- ═══════════════════════════════════════════════════════════════════════

select count(*) as allergenes_references from public.allergenes;
-- attendu : 13

select count(*)                                                     as eleves,
       count(*) filter (where fiche_alim_statut = 'non_validee')     as non_validees,
       count(*) filter (where cantine is null)                       as cantine_indeterminee
  from public.eleves;
-- attendu : 12 | 12 | 12
