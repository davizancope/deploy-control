# Deploy Control

App Next.js 16 + Supabase para registrar deploys de SFCC e gerar insights. Ver README.md.

- Next 16: `src/proxy.ts` substitui o middleware; APIs de request são assíncronas (`await params`, `await cookies()`); docs em `node_modules/next/dist/docs/`.
- Toda consulta filtra por `ctx.org.id` (de `requireContext()`), e o RLS no banco é a garantia final. Nunca usar service role no app.
- Escritas de deploy passam pelas RPCs `save_deployment` / `import_deployments` (transação única). PR/commit são por projeto e ligados a tasks (`pull_request_tasks`, `commit_tasks`); `link_mode` replace (formulário) ou merge (importação).
- Mudança de esquema = nova migration em `supabase/migrations/`, com grants explícitos (exposição automática de tabelas está desligada).
- Formulários usam `useFormAction` (evita o reset automático do React 19 quando há erro).
- Comentário avulso em código: uma linha. JSDoc completo (@param, @returns) nas funções.
- Checar com `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.
