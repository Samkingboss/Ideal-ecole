-- ÉTAPE 2 sur 2 · SUPPRIMER les neuf lignes de sonde.
--
-- NE PAS EXÉCUTER avant que `sql/app_state_sondes_select.sql` ait renvoyé
-- exactement neuf lignes.
--
-- Ce script ne formule AUCUNE hypothèse sur le nombre de lignes réelles de
-- `rh` ou de `cantine` : il ne vérifie que ce qu'il a lui-même supprimé.
--
-- ── Une seule liste ───────────────────────────────────────────────────────
--
-- La première version portait la liste DEUX fois : une pour le DELETE, une
-- pour le contrôle. Elles ont divergé au premier ajout — la suppression visait
-- neuf couples, le contrôle n'en vérifiait que huit. Un contrôle qui ne couvre
-- pas le cas pour lequel il existe ne vaut rien.
--
-- La liste est donc écrite UNE fois, dans une table temporaire, et sert aux
-- deux. Elles ne peuvent plus diverger.
--
-- ── Droits ────────────────────────────────────────────────────────────────
--
-- RLS est active mais non forcée : le propriétaire de la table contourne les
-- policies. Aucune policy DELETE n'est requise, et il ne faut surtout pas en
-- créer une — ce serait rouvrir la suppression à tout le monde.

begin;

create temporary table sondes_a_supprimer (app text, key text) on commit drop;

insert into sondes_a_supprimer (app, key) values
  ('__probe__',      '__probe__'),
  ('__sonde_ideal',  '__sonde'),
  ('__sonde_x',      '__s'),
  ('audit_test',     'audit_test'),
  ('diagnostic',     'garde_ecriture_24_08'),
  ('cantine',        '__sonde_pointage'),
  ('rh',             '__sonde_dossier'),
  ('__garde__',      '__sonde_ecriture__'),
  ('__recette__',    '__recette__');

-- Contrôle AVANT : la liste doit désigner neuf lignes réellement présentes.
-- Une ligne déjà absente, ou une de plus, veut dire que la base n'est pas
-- dans l'état constaté — on s'arrête plutôt que de supprimer à l'aveugle.
do $$
declare v_visees integer; v_presentes integer;
begin
  select count(*) into v_visees from sondes_a_supprimer;
  select count(*) into v_presentes
    from public.app_state a join sondes_a_supprimer s
      on s.app = a.app and s.key = a.key;
  if v_visees <> 9 then
    raise exception 'LA LISTE NE PORTE PAS NEUF COUPLES : %', v_visees;
  end if;
  if v_presentes <> v_visees then
    raise exception 'ETAT INATTENDU : % couples vises, % presents en base', v_visees, v_presentes;
  end if;
end $$;

delete from public.app_state a
 using sondes_a_supprimer s
 where a.app = s.app and a.key = s.key;

-- Contrôle APRÈS : ces couples — les mêmes, pas une autre liste — valent zéro.
do $$
declare v_restantes integer;
begin
  select count(*) into v_restantes
    from public.app_state a join sondes_a_supprimer s
      on s.app = a.app and s.key = a.key;
  if v_restantes <> 0 then
    raise exception 'SONDES RESTANTES : % — rien ne doit etre valide', v_restantes;
  end if;
end $$;

commit;

-- Aucun rollback n'est fourni : ces neuf lignes n'ont aucun contenu métier.
-- Si l'une d'elles devait être conservée, c'est le SELECT de l'étape 1 qui
-- devait le révéler, avant la suppression.
