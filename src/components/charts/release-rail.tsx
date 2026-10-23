import Link from 'next/link'
import { addDays, daysBetween, formatDate } from '@/lib/format'
import type { DashDeploy } from '@/lib/insights'

type Lane = { project_id: string; project_name: string; deploys: DashDeploy[] }

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/**
 * Trilho de releases: uma faixa por projeto, com os deploys de staging em cima e os de produção embaixo, no tempo.
 * Marcador maior indica mais de um deploy no mesmo dia; o tooltip lista todos.
 * @param props.lanes Projetos com seus deploys no período.
 * @param props.from Início do período.
 * @param props.to Fim do período.
 * @returns Gráfico em HTML/CSS com tooltip por marcador.
 */
export function ReleaseRail({ lanes, from, to }: { lanes: Lane[]; from: string; to: string }) {
  const span = Math.max(1, daysBetween(from, to))
  const pos = (iso: string) => `${(Math.min(span, Math.max(0, daysBetween(from, iso))) / span) * 100}%`

  const months: string[] = []
  for (let d = from.slice(0, 8) + '01'; d <= to; d = addDays(d, 32).slice(0, 8) + '01') if (d >= from) months.push(d)

  return (
    <figure className="rounded-lg border border-line bg-surface">
      <figcaption className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <span className="font-semibold">Trilho de releases</span>
        <span className="flex flex-wrap items-center gap-4 text-sm text-ink-2">
          <Legend kind="staging" label="Staging" />
          <Legend kind="production" label="Produção" />
          <Legend kind="hotfix" label="Hotfix em produção" />
        </span>
      </figcaption>

      <div className="px-5 pt-2 pb-4">
        <div className="relative ml-0 h-6 sm:ml-36" aria-hidden="true">
          {months.map((m) => (
            <span key={m} className="absolute top-1 -translate-x-1/2 text-xs text-muted" style={{ left: pos(m) }}>
              {MONTHS[Number(m.slice(5, 7)) - 1]}
            </span>
          ))}
        </div>
        <ul className="space-y-1">
          {lanes.map((lane) => (
            <li key={lane.project_id} className="grid items-center gap-x-4 sm:grid-cols-[8rem_1fr]">
              <Link href={`/deploys?projeto=${lane.project_id}`} className="truncate text-sm font-medium hover:underline" title={lane.project_name}>
                {lane.project_name}
              </Link>
              <div className="relative h-14 rounded-md bg-sunken/60">
                {months.map((m) => (
                  <span key={m} aria-hidden="true" className="absolute inset-y-0 w-px bg-line" style={{ left: pos(m) }} />
                ))}
                <span aria-hidden="true" className="absolute inset-x-2 top-1/2 h-px bg-line-strong" />
                {groupByDay(lane.deploys).map((g) => (
                  <Marker key={`${g.env}-${g.date}`} group={g} left={pos(g.date)} projectId={lane.project_id} />
                ))}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-right text-xs text-muted">{formatDate(from)} até {formatDate(to)}</p>
      </div>
    </figure>
  )
}

type Group = { date: string; env: 'staging' | 'production'; hotfix: boolean; deploys: DashDeploy[] }

function groupByDay(deploys: DashDeploy[]): Group[] {
  const map = new Map<string, Group>()
  for (const d of deploys) {
    const key = `${d.environment}|${d.deployed_on}`
    const g = map.get(key) ?? { date: d.deployed_on, env: d.environment, hotfix: false, deploys: [] }
    g.deploys.push(d)
    if (d.type === 'hotfix') g.hotfix = true
    map.set(key, g)
  }
  return [...map.values()]
}

function Marker({ group: g, left, projectId }: { group: Group; left: string; projectId: string }) {
  const prod = g.env === 'production'
  const color = prod ? (g.hotfix ? 'text-hotfix' : 'text-production') : 'text-staging'
  const href = g.deploys.length === 1 ? `/deploys/${g.deploys[0].id}` : `/deploys?projeto=${projectId}&de=${g.date}&ate=${g.date}`
  const label = `${prod ? 'Produção' : 'Staging'}, ${formatDate(g.date)}: ${g.deploys.map((d) => d.code_version).join(', ')}`

  return (
    <Link
      href={href}
      aria-label={label}
      className={`group absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-1.5 ${color} ${prod ? 'top-[72%]' : 'top-[28%]'} hover:z-20 focus-visible:z-20`}
      style={{ left }}
    >
      <svg width={g.deploys.length > 1 ? 15 : 12} height={g.deploys.length > 1 ? 15 : 12} viewBox="0 0 10 10" aria-hidden="true" className="block">
        {prod ? (
          <path d="M5 0.3 9.7 5 5 9.7 0.3 5z" fill="currentColor" stroke="var(--surface)" strokeWidth="1" />
        ) : (
          <circle cx="5" cy="5" r="3.7" fill="var(--surface)" stroke="currentColor" strokeWidth="2" />
        )}
      </svg>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-30 mb-1 w-max max-w-64 -translate-x-1/2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-left text-xs text-ink shadow-md group-hover:visible group-focus-visible:visible"
      >
        <span className="block text-ink-2">
          {g.deploys.length > 1 ? `${g.deploys.length} deploys em ` : ''}
          {prod ? (g.hotfix ? 'produção, com hotfix' : 'produção') : 'staging'} em {formatDate(g.date)}
        </span>
        {g.deploys.slice(0, 5).map((d) => (
          <span key={d.id} className="code block">{d.code_version}</span>
        ))}
        {g.deploys.length > 5 && <span className="block text-muted">e mais {g.deploys.length - 5}</span>}
      </span>
    </Link>
  )
}

function Legend({ kind, label }: { kind: 'staging' | 'production' | 'hotfix'; label: string }) {
  const color = kind === 'staging' ? 'text-staging' : kind === 'production' ? 'text-production' : 'text-hotfix'
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="11" height="11" viewBox="0 0 10 10" aria-hidden="true" className={color}>
        {kind === 'staging' ? <circle cx="5" cy="5" r="3.7" fill="none" stroke="currentColor" strokeWidth="2" /> : <path d="M5 0.3 9.7 5 5 9.7 0.3 5z" fill="currentColor" />}
      </svg>
      {label}
    </span>
  )
}
