begin;

alter table public.comprehensions drop constraint if exists comprehensions_checkpoint_coherent;
alter table public.comprehensions drop constraint if exists comprehensions_checkpoint_unicite;
alter table public.comprehensions add constraint comprehensions_unicite unique (eleve_id, date_cours, matiere);
drop index if exists public.comprehensions_preparation_idx;
alter table public.comprehensions
  drop column if exists statut,
  drop column if exists comprehension,
  drop column if exists participation,
  drop column if exists preparation_id;

commit;
