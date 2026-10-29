import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { EnvMark, TypeBadge } from '@/components/ui'
import { getTaskTimeline } from '@/lib/data'
import { daysBetween, formatDate, plural } from '@/lib/format'
import { requireContext } from '@/lib/session'

export async function generateMetadata({ params }: PageProps<'/tasks/[key]'>): Promise<Metadata> {
  const { key } = await params
  return { title: decodeURIComponent(key).toUpperCase() }
}

export default async function TaskPage({ params }: PageProps<'/tasks/[key]'>) {
  const ctx = await requireContext()
  const key = decodeURIComponent((await params).key).toUpperCase()
  if (!/^[A-Z][A-Z0-9]{1,19}-\d{1,7}$/.test(key)) notFound()
  const timeline = await getTaskTimeline(ctx, key)

  const staging = timeline.filter((t) => t.environment === 'staging')
  const production = timeline.filter((t) => t.environment === 'production')
  const firstStaging = staging[0]?.deployed_on
  const firstProd = production[0]?.deployed_on
  const jira = timeline.find((t) => t.jira_base_url)?.jira_base_url

  return (
    <>
      <header className="mb-8">
        <p className="mb-2 text-ink-2"><Link href="/deploys" className="link">Deploys</Link></p>
        <h1 className="code text-[34px] font-semibold tracking-tight">{key}</h1>
        {jira && (
          <a href={`${jira}/browse/${key}`} target="_blank" rel="noopener noreferrer" className="link mt-1 inline-block">
            Abrir no Jira<span className="sr-only"> (nova aba)</span> ↗
          </a>
        )}
      </header>

      {timeline.length === 0 ? (
        <p className="text-ink-2">Nenhum deploy registrado com essa task.</p>
      ) : (
        <>
          <dl className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Deploys em staging" value={String(staging.length)} />
            <Stat label="Deploys em produção" value={String(production.length)} />
            <Stat label="Primeiro staging" value={firstStaging ? formatDate(firstStaging) : '—'} />
            <Stat
              label="Staging → produção"
              value={firstStaging && firstProd ? plural(Math.max(0, daysBetween(firstStaging, firstProd)), 'dia', 'dias') : firstProd ? '—' : 'Ainda em staging'}
            />
          </dl>

          <h2 className="mb-4 text-lg font-semibold">Linha do tempo</h2>
          <ol className="relative ml-2 border-l-2 border-line">
            {timeline.map((t) => (
              <li key={t.id} className="relative pb-6 pl-6 last:pb-0">
                <span className={`absolute top-0.5 -left-[11px] rounded-full bg-pop p-0.5 ${t.environment === 'production' ? 'text-production' : 'text-staging'}`}>
                  <EnvMark env={t.environment} size={16} />
                </span>
                <p className="text-sm text-ink-2">{formatDate(t.deployed_on)}, {t.project_name}</p>
                <p className="flex flex-wrap items-center gap-2">
                  <Link href={`/deploys/${t.id}`} className="code font-medium hover:underline">{t.code_version}</Link>
                  <span className={`inline-flex items-center gap-1 text-sm ${t.environment === 'production' ? 'text-production' : 'text-staging'}`}>
                    <EnvMark env={t.environment} />
                    {t.environment === 'production' ? 'Produção' : 'Staging'}
                  </span>
                  <TypeBadge type={t.type} />
                </p>
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl px-4 py-3">
      <dt className="text-sm text-ink-2">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tracking-tight">{value}</dd>
    </div>
  )
}
