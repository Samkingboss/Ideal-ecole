-- ═══════════════════════════════════════════════════════════════════════
-- ROLLBACK — S0, confinement d'urgence de public.eleves et public.classes
--
--        ⚠⚠⚠  CE ROLLBACK ROUVRE LES DONNÉES ÉLÈVES À INTERNET  ⚠⚠⚠
--
-- Il rétablit littéralement la faille. Après son exécution, toute personne
-- disposant de la clé publiable — celle qui figure dans le code source de
-- chaque page du site — pourra de nouveau, sur les vingt-six dossiers :
--
--     LIRE      nom, prénom, date de naissance, matricule,
--               téléphone du parent, allergies connues,
--               restrictions alimentaires, notes alimentaires,
--               et la photographie d'un enfant
--     INSÉRER   des élèves
--     MODIFIER  n'importe quelle ligne
--     SUPPRIMER n'importe quelle ligne
--
-- Ce ne sont pas des hypothèses : c'est l'état mesuré avant le confinement.
--
-- À N'UTILISER QUE si la fermeture casse un usage vital, et pour le temps
-- strictement nécessaire au diagnostic.
--
-- ── AVANT DE ROULER CECI, CHERCHEZ AILLEURS ───────────────────────────
--
-- Deux causes de blocage sont bien plus probables que la fermeture
-- elle-même, et toutes deux se réparent sans rouvrir la table :
--
--   1. Une page restée sur la clé publique. `pedago-archive` a été
--      corrigée ; vérifiez qu'elle est bien DÉPLOYÉE. La réparer est
--      infiniment préférable à rouvrir la table.
--
--   2. La policy `eleves_acces_authentifie` n'a pas été créée. Vérifiez-le
--      d'abord — c'est un `create policy` oublié, pas un motif de rollback :
--
--        select policyname, cmd, roles, qual, with_check
--          from pg_policies
--         where schemaname = 'public' and tablename = 'eleves';
-- ═══════════════════════════════════════════════════════════════════════

begin;

-- ── 1 · eleves : retour à l'état mesuré au diagnostic ─────────────────
--
-- relrowsecurity était TRUE et le reste : la RLS n'a jamais été touchée.
-- On retire la policy de remplacement et on rétablit la permissive.

drop policy if exists eleves_acces_authentifie on public.eleves;

create policy acces_ouvert_eleves
  on public.eleves
  for all
  to public
  using (true)
  with check (true);

grant select, insert, update, delete, references, trigger, truncate
  on table public.eleves to anon;

-- ── 2 · classes : retour à l'état mesuré au diagnostic ────────────────
--
-- relrowsecurity était FALSE et le reste. `acces_classes` était inerte,
-- mais on la rétablit pour que l'état soit exactement celui d'avant.

create policy acces_classes
  on public.classes
  for select
  to public
  using (true);

grant select, insert, update, delete, references, trigger, truncate
  on table public.classes to anon;

commit;

-- ═══════════════════════════════════════════════════════════════════════
-- Après ce rollback, scripts/gardes/recette-fermeture-eleves.mjs DOIT
-- repasser au ROUGE — huit contrôles en échec. Si elle reste verte, le
-- rollback n'a pas pris : vérifiez-le avant de conclure quoi que ce soit.
--
-- Les grants à `public` ne sont pas rétablis : le diagnostic ne montrait
-- aucun privilège accordé à PUBLIC, seulement à anon, authenticated et
-- service_role. Ne rendez pas plus que ce qui existait.
-- ═══════════════════════════════════════════════════════════════════════
