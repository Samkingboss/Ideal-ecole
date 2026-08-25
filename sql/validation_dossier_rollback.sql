-- ═══════════════════════════════════════════════════════════════════════
-- RETOUR ARRIERE — validation d un dossier
-- ═══════════════════════════════════════════════════════════════════════
--
-- A n executer que si le correctif empeche une operation legitime.
--
-- ⚠ CE RETOUR ARRIERE ROUVRE LA VALIDATION A `anon`. Un parent qui vient de
--   deposer son dossier tient son `inscription_id` et pourra le valider
--   lui-meme. Ne l executer qu en connaissance de cause, et le refermer.
--
-- Il ne retire PAS la garde interne : reinstaller le corps d origine
-- demande de rejouer sql/inscriptions_validation_direction.sql dans sa
-- version anterieure. Le `grant` seul suffit a debloquer un appelant
-- legitime qui aurait ete pris pour un intrus.

begin;

grant execute on function public.valider_inscription_direction(uuid,text,text) to anon;

commit;

-- ATTENDU : anon_peut_valider = true
select has_function_privilege('anon',
  'public.valider_inscription_direction(uuid,text,text)', 'execute') as anon_peut_valider;
