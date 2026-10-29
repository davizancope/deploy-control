-- Prefixo das tasks do Jira por projeto (ex.: PJTX): permite informar só o número da task e montar a chave PREFIXO-NÚMERO.

alter table public.projects
  add column jira_project_prefix text
  check (jira_project_prefix ~ '^[A-Z][A-Z0-9]{1,19}$');

-- Os grants de projects já cobrem a coluna nova (grant na tabela inteira); as policies de RLS não mudam.
