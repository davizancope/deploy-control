import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { listProjects } from '@/lib/data'
import { formatDate, plural } from '@/lib/format'
import { requireContext } from '@/lib/session'
import { undoImport } from './actions'
import { Importer } from './importer'

export const metadata: Metadata = { title: 'Importar planilha' }

type Batch = { id: string; file_name: string; row_count: number; created_at: string }

export default async function ImportPage({ searchParams }: PageProps<'/importar'>) {
  const ctx = await requireContext()
  if (!ctx.canWrite) redirect('/')
  const sp = await searchParams
  const [projects, { data: batches }] = await Promise.all([
    listProjects(ctx),
    ctx.supabase.from('import_batches').select('id, file_name, row_count, created_at').eq('org_id', ctx.org.id).order('created_at', { ascending: false }).limit(20),
  ])
  const ok = Number(sp.ok) || 0
  const dup = Number(sp.dup) || 0

  return (
    <>
      <header className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight">Importar planilha</h1>
        <p className="max-w-[70ch] text-ink-2">
          Traz o histórico da planilha de controle de versão. Datas, tasks, PRs e commits são separados e padronizados na leitura.
        </p>
      </header>

      {ok > 0 && (
        <p role="status" className="mb-6 rounded-xl border border-production/30 bg-production-soft px-3 py-2">
          {plural(ok, 'deploy importado', 'deploys importados')}.{dup > 0 ? ` ${plural(dup, 'já existia e foi pulado', 'já existiam e foram pulados')}.` : ''}
        </p>
      )}
      {sp.desfeito && (
        <p role="status" className="mb-6 glass rounded-2xl px-4 py-2.5">Importação desfeita. Os deploys dela foram removidos.</p>
      )}

      <Importer projects={projects.map((p) => ({ id: p.id, name: p.name }))} canManage={ctx.canManage} />

      {(batches ?? []).length > 0 && (
        <section className="mt-12" aria-labelledby="hist">
          <h2 id="hist" className="mb-3 text-lg font-semibold">Importações feitas</h2>
          <ul className="divide-y divide-line glass rounded-2xl">
            {(batches as Batch[]).map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span>
                  <span className="font-medium">{b.file_name}</span>
                  <span className="text-ink-2">, {plural(b.row_count, 'deploy', 'deploys')} em {formatDate(b.created_at.slice(0, 10))}</span>
                </span>
                <details className="relative">
                  <summary className="btn list-none px-3 text-sm text-danger hover:bg-danger-soft [&::-webkit-details-marker]:hidden">Desfazer</summary>
                  <form action={undoImport} className="absolute right-0 z-10 mt-2 w-72 glass-pop rounded-2xl p-4">
                    <input type="hidden" name="id" value={b.id} />
                    <p className="mb-3 text-sm">Remove os {b.row_count} deploys desta importação. Os projetos continuam.</p>
                    <button type="submit" className="btn-danger w-full">Desfazer importação</button>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
