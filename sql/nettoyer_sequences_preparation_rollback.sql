begin;

drop function if exists public.nettoyer_sequences_preparation(
  uuid[], date, smallint, smallint
);

commit;
