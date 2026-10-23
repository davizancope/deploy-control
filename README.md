# Deploy Control

Registro de deploys (code versions de SFCC e afins) com histórico, busca e insights por projeto: ritmo de releases, tempo de staging até produção, taxa de hotfix, tasks paradas em staging e retrabalho.

Stack: Next.js 16 (App Router, Server Actions), Supabase (Postgres + Auth + RLS), Tailwind CSS 4, TypeScript.

## Rodando localmente

Pré-requisito: Node 20.9 ou mais novo (`node -v`).

### 1. Criar as tabelas no Supabase

No painel do projeto: **SQL Editor → New query**, cole o conteúdo de cada arquivo de `supabase/migrations/`,
na ordem do nome, e clique em **Run** (um por vez). Cada um deve terminar com "Success. No rows returned".

- `20261023000000_init.sql`: esquema inicial.
- `20261023020000_pr_task_links.sql`: PRs e commits ligados às tasks.
- `20261023030000_deploy_message_template.sql`: modelo da mensagem ao time (página **Mensagem ao time**).

### 2. Configurar os links de e-mail

**Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000`
- **Redirect URLs**: adicione `http://localhost:3000/**`

### 3. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha com os dados de **Project Settings → API Keys**:

```
NEXT_PUBLIC_SUPABASE_URL=https://<seu-projeto>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

A publishable key pode ficar no navegador: quem protege os dados é o RLS. **Nunca** coloque a secret key (`sb_secret_...`) ou a `service_role` neste projeto.

### 4. Subir

```bash
npm install
npm run dev
```

Abra http://localhost:3000, crie a conta, confirme pelo e-mail, crie a organização e importe a planilha
(no Google Sheets: **Arquivo → Fazer download → Microsoft Excel (.xlsx)**).

> O e-mail padrão do Supabase só entrega para endereços que são membros do time do projeto no Supabase e tem limite de poucos envios por hora.
> No piloto, cadastre-se com o mesmo e-mail da sua conta do Supabase. Para liberar o time, configure um SMTP próprio em **Authentication → Emails → SMTP Settings**.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e servidor de produção |
| `npm test` | Testes (parser da planilha, insights) |
| `npm run lint` / `npm run typecheck` | ESLint e TypeScript |

## Segurança

- **Multi-tenant por organização.** Toda tabela tem `org_id` e RLS: só membros da organização leem; `owner/admin/member` escrevem; `viewer` só lê. Chaves estrangeiras compostas impedem um deploy de apontar para projeto de outra organização.
- **Nada exposto por padrão.** Grants explícitos só para `authenticated`; `anon` não acessa nenhuma tabela.
- **Gravações atômicas.** Deploy + tasks + PRs + commits são salvos por RPC numa transação; a importação inteira entra ou não entra.
- **Sessão** via `@supabase/ssr` com cookies httpOnly, renovada no `src/proxy.ts`, que também bloqueia rotas sem login.
- Validação com zod em todas as Server Actions, redirects só para caminhos internos, headers de segurança no `next.config.ts`.

## Estrutura

```
supabase/migrations/      esquema, RLS, RPCs e views
src/proxy.ts              sessão e proteção de rotas
src/lib/parse/            leitura e normalização da planilha (com testes)
src/lib/insights.ts       cálculo dos indicadores do painel
src/lib/data.ts           consultas
src/app/(auth)/           login, cadastro, recuperação de senha
src/app/(app)/            painel, deploys, tasks, projetos, importação
```

## Publicar depois

1. Suba o código para um repositório e importe na Vercel (ou outro host de Next.js).
2. Cadastre as mesmas três variáveis, com `NEXT_PUBLIC_SITE_URL` apontando para o domínio final.
3. No Supabase, troque o Site URL e adicione `https://<seu-dominio>/**` nos Redirect URLs.

## PRs, commits e tasks

Todo PR ou commit fica ligado a uma ou mais tasks, ou marcado como "sem task" com uma descrição do que mudou.
O vínculo é do PR, não do deploy: se o PR 1468 é da ABC-123, ele continua sendo em todos os deploys em que aparecer.
Na importação, a coluna de tasks e a de PRs são pareadas linha a linha; o que não der para parear vai para **Vincular PRs**.

## Próximos passos

- Convites e gestão de membros (a tabela `memberships` e os papéis já existem).
- Integração com Jira (título, status e responsável das tasks).
- Webhook do Bitbucket e API key para o pipeline registrar o deploy sozinho.
