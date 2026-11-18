import Link from 'next/link'
import { Suspense } from 'react'
import { BrandMark } from '@/components/icons'
import { SubmitButton } from '@/components/ui'
import { signOut } from '@/app/(auth)/actions'
import { listProjects, projectIdsFilter } from '@/lib/data'
import { requireContext, type AppContext } from '@/lib/session'
import { ROLE_LABEL } from '@/lib/types'
import { Nav } from './nav'
import { OrgSwitcher } from './org-switcher'

/**
 * Menu lateral com o contador de PRs e commits a vincular; busca o número em streaming para não segurar a página.
 * @param props.ctx Contexto da requisição.
 * @returns Navegação principal com o contador.
 */
async function NavWithPendingLinks({ ctx }: { ctx: AppContext }) {
  const scope = projectIdsFilter(await listProjects(ctx))
  const [prs, commits] = await Promise.all([
    ctx.supabase.from('pull_request_summary').select('id', { count: 'exact', head: true }).eq('org_id', ctx.org.id).eq('link_status', 'pending').in('project_id', scope),
    ctx.supabase.from('commit_summary').select('id', { count: 'exact', head: true }).eq('org_id', ctx.org.id).eq('link_status', 'pending').in('project_id', scope),
  ])
  return <Nav pendingLinks={(prs.count ?? 0) + (commits.count ?? 0)} />
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext()
  return (
    <div className="md:grid md:min-h-dvh md:grid-cols-[256px_1fr]">
      <aside className="glass m-3 flex flex-col gap-4 rounded-3xl px-4 py-4 md:sticky md:top-3 md:h-[calc(100dvh-1.5rem)] md:py-5">
        <div className="flex items-center gap-2">
          <Link href="/" aria-label="Painel" className="shrink-0">
            <BrandMark size={30} />
          </Link>
          <div className="min-w-0 flex-1">
            <OrgSwitcher orgs={ctx.orgs} activeId={ctx.org.id} />
          </div>
        </div>
        {ctx.canWrite && (
          <Link href="/deploys/novo" className="btn-primary w-full">Registrar deploy</Link>
        )}
        <Suspense fallback={<Nav pendingLinks={0} />}>
          <NavWithPendingLinks ctx={ctx} />
        </Suspense>
        <div className="flex items-center justify-between gap-3 border-t border-line pt-3 text-sm md:mt-auto md:block md:pt-4">
          <div className="min-w-0">
            <p className="truncate text-ink-2" title={ctx.user.email}>{ctx.user.email}</p>
            <p className="text-muted">{ROLE_LABEL[ctx.org.role]}</p>
          </div>
          <form action={signOut} className="md:mt-3">
            <SubmitButton className="link inline-flex items-center gap-2 text-sm" pending="Saindo…">Sair</SubmitButton>
          </form>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-4 md:px-8 md:py-8">
        <div className="mx-auto max-w-[1180px]">{children}</div>
      </main>
    </div>
  )
}
