-- Suivi du stock, demandes de matériel des enseignants, et registre des
-- sanctions du personnel.
--
-- Décidé avec le directeur le 16 août 2026 :
--   · l'enseignant demande le matériel dont il a besoin pour sa classe ;
--   · le surveillant valide et confirme la livraison ; c'est cette
--     confirmation, et elle seule, qui sort la quantité du stock ;
--   · le directeur voit dans la fiche d'activité de chaque employé tout ce
--     que la plateforme sait de lui, sanctions comprises.
--
-- Pourquoi de vraies tables plutôt qu'une clé `app_state` : le registre de la
-- cantine, stocké ainsi, est déjà signalé comme un défaut dans
-- docs/etat-des-lieux.md — aucune recherche possible, tout l'historique dans
-- une seule ligne JSON qui grossit sans limite, et un stock qui devient faux
-- dès que deux personnes écrivent en même temps.
--
-- À exécuter une fois dans le SQL Editor de Supabase.


-- ════════════════════════════════════════════════════════════════════════
-- 1. Catalogue du matériel
-- ════════════════════════════════════════════════════════════════════════
--
-- `quantite` n'est jamais modifiée à la main par l'application : elle est
-- recalculée par le déclencheur du bas à partir des mouvements. Un stock qui
-- se corrige au doigt finit toujours par mentir.

create table if not exists public.materiels (
  id            uuid primary key default gen_random_uuid(),
  nom           text not null,
  unite         text not null default 'unité',   -- unité, boîte, ramette, paquet…
  quantite      integer not null default 0,
  seuil_alerte  integer not null default 0,      -- en dessous, le surveillant est prévenu
  actif         boolean not null default true,
  created_at    timestamptz not null default now(),

  constraint mat_nom_unique unique (nom),
  constraint mat_quantite_positive check (quantite >= 0),
  constraint mat_seuil_positif   check (seuil_alerte >= 0)
);


-- ════════════════════════════════════════════════════════════════════════
-- 2. Mouvements de stock
-- ════════════════════════════════════════════════════════════════════════
--
-- Toute variation passe par une ligne ici : réception d'achat, remise à un
-- enseignant, perte, correction d'inventaire. Le stock est la somme des
-- mouvements, jamais une valeur saisie. On sait donc toujours d'où vient un
-- écart, et qui l'a provoqué.

create table if not exists public.mouvements_stock (
  id           uuid primary key default gen_random_uuid(),
  materiel_id  uuid not null references public.materiels(id) on delete cascade,
  -- Positif : ce qui entre. Négatif : ce qui sort. Jamais zéro, un mouvement
  -- nul n'est pas un mouvement.
  quantite     integer not null,
  motif        text not null,                    -- 'reception' | 'livraison' | 'perte' | 'inventaire'
  commentaire  text,
  demande_id   uuid,                             -- renseigné quand le mouvement solde une demande
  saisi_par    uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now(),

  constraint mvt_quantite_non_nulle check (quantite <> 0)
);

create index if not exists mvt_materiel_idx on public.mouvements_stock (materiel_id, created_at desc);


-- ════════════════════════════════════════════════════════════════════════
-- 3. Demandes de matériel des enseignants
-- ════════════════════════════════════════════════════════════════════════
--
-- Cycle : en_attente → validee → livree, ou en_attente → refusee.
-- `quantite_livree` peut différer de `quantite` : le surveillant livre ce
-- qu'il a. Mieux vaut une livraison partielle enregistrée qu'une demande
-- close sur un chiffre faux.

create table if not exists public.demandes_materiel (
  id               uuid primary key default gen_random_uuid(),
  demandeur_id     uuid not null references public.users(id) on delete cascade,
  materiel_id      uuid references public.materiels(id) on delete set null,
  -- Le libellé est conservé même si l'article disparaît du catalogue, et
  -- permet de demander quelque chose qui n'y figure pas encore.
  libelle          text not null,
  quantite         integer not null,
  groupe           text,                          -- la classe concernée, si elle l'est
  motif            text,
  statut           text not null default 'en_attente',
  quantite_livree  integer,
  traite_par       uuid references public.users(id) on delete set null,
  traite_le        timestamptz,
  commentaire_traitement text,
  created_at       timestamptz not null default now(),

  constraint dem_quantite_positive check (quantite > 0),
  constraint dem_statut_connu check (statut in ('en_attente','validee','livree','refusee')),
  -- Une demande livrée dit forcément combien, par qui et quand. Sans cela on
  -- ne saurait pas ce qui est réellement sorti du magasin.
  constraint dem_livraison_complete check (
    statut <> 'livree'
    or (quantite_livree is not null and quantite_livree >= 0
        and traite_par is not null and traite_le is not null)
  )
);

create index if not exists dem_statut_idx     on public.demandes_materiel (statut, created_at desc);
create index if not exists dem_demandeur_idx  on public.demandes_materiel (demandeur_id, created_at desc);


-- ════════════════════════════════════════════════════════════════════════
-- 4. Registre des sanctions du personnel
-- ════════════════════════════════════════════════════════════════════════
--
-- Donnée sensible sur une personne : on la traite comme telle. Une sanction
-- ne se supprime pas — aucune politique de DELETE n'est ouverte — mais elle
-- peut être levée, ce qui laisse la trace de la décision et de sa levée.
-- Le motif est obligatoire : une sanction sans motif écrit n'est pas une
-- sanction, c'est une humeur.

create table if not exists public.sanctions_personnel (
  id           uuid primary key default gen_random_uuid(),
  employe_id   uuid not null references public.users(id) on delete cascade,
  type         text not null,                    -- 'avertissement' | 'blame' | 'mise_a_pied' | 'autre'
  motif        text not null,
  date_effet   date not null,
  levee_le     date,
  levee_motif  text,
  prononcee_par uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now(),

  constraint sanc_type_connu check (type in ('avertissement','blame','mise_a_pied','autre')),
  constraint sanc_motif_non_vide check (length(btrim(motif)) > 0),
  -- Une levée se justifie autant que la sanction elle-même.
  constraint sanc_levee_motivee check (levee_le is null or length(btrim(coalesce(levee_motif,''))) > 0)
);

create index if not exists sanc_employe_idx on public.sanctions_personnel (employe_id, date_effet desc);


-- ════════════════════════════════════════════════════════════════════════
-- 5. Le stock se recalcule tout seul
-- ════════════════════════════════════════════════════════════════════════
--
-- L'application n'écrit jamais `materiels.quantite` : elle insère un
-- mouvement, et le stock suit. C'est ce qui garantit que le chiffre affiché
-- correspond toujours à la somme de ce qui est entré et sorti.

create or replace function public.maj_stock_materiel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.materiels set quantite = quantite + new.quantite where id = new.materiel_id;
  elsif (tg_op = 'DELETE') then
    update public.materiels set quantite = quantite - old.quantite where id = old.materiel_id;
  elsif (tg_op = 'UPDATE') then
    update public.materiels set quantite = quantite - old.quantite where id = old.materiel_id;
    update public.materiels set quantite = quantite + new.quantite where id = new.materiel_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_maj_stock on public.mouvements_stock;
create trigger trg_maj_stock
  after insert or update or delete on public.mouvements_stock
  for each row execute function public.maj_stock_materiel();


-- ════════════════════════════════════════════════════════════════════════
-- 6. Règles d'accès
-- ════════════════════════════════════════════════════════════════════════
--
-- Supabase active RLS d'office sur toute table neuve : sans ces règles,
-- l'application lirait des listes vides et toute écriture serait refusée en
-- 401, sans message clair.
--
-- Ces politiques sont ouvertes, comme le reste de la base aujourd'hui : la
-- plateforme n'a pas encore d'authentification réelle et la clé publique fait
-- tout. C'est le chantier n° 7 du document de reprise, et ces quatre tables
-- devront y passer comme les autres. La suppression n'est ouverte nulle part :
-- un mouvement de stock et une sanction laissent trace.

alter table public.materiels            enable row level security;
alter table public.mouvements_stock     enable row level security;
alter table public.demandes_materiel    enable row level security;
alter table public.sanctions_personnel  enable row level security;

drop policy if exists mat_lecture    on public.materiels;
create policy mat_lecture    on public.materiels for select using (true);
drop policy if exists mat_saisie     on public.materiels;
create policy mat_saisie     on public.materiels for insert with check (true);
drop policy if exists mat_correction on public.materiels;
create policy mat_correction on public.materiels for update using (true) with check (true);

drop policy if exists mvt_lecture on public.mouvements_stock;
create policy mvt_lecture on public.mouvements_stock for select using (true);
drop policy if exists mvt_saisie  on public.mouvements_stock;
create policy mvt_saisie  on public.mouvements_stock for insert with check (true);

drop policy if exists dem_lecture    on public.demandes_materiel;
create policy dem_lecture    on public.demandes_materiel for select using (true);
drop policy if exists dem_saisie     on public.demandes_materiel;
create policy dem_saisie     on public.demandes_materiel for insert with check (true);
drop policy if exists dem_correction on public.demandes_materiel;
create policy dem_correction on public.demandes_materiel for update using (true) with check (true);

drop policy if exists sanc_lecture    on public.sanctions_personnel;
create policy sanc_lecture    on public.sanctions_personnel for select using (true);
drop policy if exists sanc_saisie     on public.sanctions_personnel;
create policy sanc_saisie     on public.sanctions_personnel for insert with check (true);
drop policy if exists sanc_correction on public.sanctions_personnel;
create policy sanc_correction on public.sanctions_personnel for update using (true) with check (true);


-- ════════════════════════════════════════════════════════════════════════
-- 7. Contrôle
-- ════════════════════════════════════════════════════════════════════════
-- Les quatre tables doivent exister et être vides.

select 'materiels' as table_creee, count(*) as lignes from public.materiels
union all select 'mouvements_stock',    count(*) from public.mouvements_stock
union all select 'demandes_materiel',   count(*) from public.demandes_materiel
union all select 'sanctions_personnel', count(*) from public.sanctions_personnel;
