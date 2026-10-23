-- Mensagem padrão ao time para novas releases: um modelo por organização, com campos {{campo}} preenchidos na tela do deploy.

create table public.deploy_message_templates (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger deploy_message_templates_touch_updated_at
before update on public.deploy_message_templates
for each row execute function public.touch_updated_at();

alter table public.deploy_message_templates enable row level security;

create policy "membros veem o modelo de mensagem" on public.deploy_message_templates
  for select to authenticated using (public.is_org_member(org_id));
create policy "owner/admin criam o modelo de mensagem" on public.deploy_message_templates
  for insert to authenticated with check (public.can_manage(org_id));
create policy "owner/admin editam o modelo de mensagem" on public.deploy_message_templates
  for update to authenticated using (public.can_manage(org_id)) with check (public.can_manage(org_id));

-- Grants explícitos (exposição automática de tabelas está desligada); anon não recebe nada.
grant select, insert, update on public.deploy_message_templates to authenticated;
