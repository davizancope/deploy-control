-- Merge de uma branch na master (ou outra branch de destino): fecha o ciclo de vida no mapa de branches sem contar como deploy.

create table public.branch_merges (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null,
  branch text not null check (char_length(btrim(branch)) between 1 and 200),
  target_branch text not null default 'master' check (char_length(btrim(target_branch)) between 1 and 200),
  merged_on date not null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  -- Uma branch entra uma vez em cada destino; registrar de novo só corrige a data.
  unique (project_id, branch, target_branch),
  -- FK composta: o merge nunca aponta para projeto de outra organização.
  foreign key (project_id, org_id) references public.projects (id, org_id) on delete cascade
);
create index branch_merges_org_project_idx on public.branch_merges (org_id, project_id);

alter table public.branch_merges enable row level security;

create policy "membros veem merges" on public.branch_merges
  for select to authenticated using (public.is_org_member(org_id));
create policy "quem escreve registra merges" on public.branch_merges
  for insert to authenticated with check (public.can_write(org_id));
create policy "quem escreve corrige merges" on public.branch_merges
  for update to authenticated using (public.can_write(org_id)) with check (public.can_write(org_id));
create policy "quem escreve desfaz merges" on public.branch_merges
  for delete to authenticated using (public.can_write(org_id));

-- Grants explícitos: "Automatically expose new tables" está desligado e anon não recebe nada.
grant select, insert, update, delete on public.branch_merges to authenticated;
