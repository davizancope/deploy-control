import Link from 'next/link'
import { signOut } from '@/app/(auth)/actions'
import { requireContext } from '@/lib/session'
import { ROLE_LABEL } from '@/lib/types'
import { Nav } from './nav'
import { OrgSwitcher } from './org-switcher'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext()
  const [prs, commits] = await Promise.all([
    ctx.supabase.from('pull_request_summary').select('id', { count: 'exact', head: true }).eq('org_id', ctx.org.id).eq('link_status', 'pending'),
    ctx.supabase.from('commit_summary').select('id', { count: 'exact', head: true }).eq('org_id', ctx.org.id).eq('link_status', 'pending'),
  ])
  const pendingLinks = (prs.count ?? 0) + (commits.count ?? 0)
  return (
    <div className="md:grid md:min-h-dvh md:grid-cols-[232px_1fr]">
      <aside className="flex flex-col gap-4 border-b border-line bg-surface px-4 py-4 md:sticky md:top-0 md:h-dvh md:border-r md:border-b-0 md:py-6">
        <div className="flex items-center gap-2">
          <Link href="/" aria-label="Painel" className="shrink-0">
            <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
              <rect width="32" height="32" rx="7" className="fill-ink" />
              <path d="M6 21h20" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" />
              <circle cx="11" cy="21" r="3" fill="var(--paper)" stroke="var(--staging)" strokeWidth="2" />
              <path d="M21 15.5l4.5 5.5-4.5 5.5-4.5-5.5z" fill="var(--production)" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <OrgSwitcher orgs={ctx.orgs} activeId={ctx.org.id} />
          </div>
        </div>
        {ctx.canWrite && (
          <Link href="/deploys/novo" className="btn-primary w-full">Registrar deploy</Link>
        )}
        <Nav pendingLinks={pendingLinks} />
        <div className="flex items-center justify-between gap-3 border-t border-line pt-3 text-sm md:mt-auto md:block md:pt-4">
          <div className="min-w-0">
            <p className="truncate text-ink-2" title={ctx.user.email}>{ctx.user.email}</p>
            <p className="text-muted">{ROLE_LABEL[ctx.org.role]}</p>
          </div>
          <form action={signOut} className="md:mt-3">
            <button type="submit" className="link text-sm">Sair</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 md:px-10 md:py-8">
        <div className="mx-auto max-w-[1180px]">{children}</div>
      </main>
    </div>
  )
}
