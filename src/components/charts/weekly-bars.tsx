import { formatDate } from '@/lib/format'
import type { WeekBucket } from '@/lib/insights'

/**
 * Deploys por semana, empilhando produção (base) e staging (topo).
 * @param props.weeks Semanas do período, da mais antiga para a mais nova.
 * @returns Gráfico de barras em HTML/CSS com tooltip por semana e tabela acessível.
 */
export function WeeklyBars({ weeks }: { weeks: WeekBucket[] }) {
  const max = Math.max(1, ...weeks.map((w) => w.staging + w.production))
  const labelEvery = weeks.length > 16 ? 4 : weeks.length > 8 ? 2 : 1

  return (
    <figure className="rounded-lg border border-line bg-surface">
      <figcaption className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <span className="font-semibold">Deploys por semana</span>
        <span className="flex items-center gap-4 text-sm text-ink-2">
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-staging" aria-hidden="true" />Staging</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-production" aria-hidden="true" />Produção</span>
        </span>
      </figcaption>
      <div className="px-5 pt-4 pb-3">
        <div className="relative h-44" aria-hidden="true">
          <span className="absolute inset-x-0 top-0 border-t border-dashed border-line" />
          <span className="absolute top-0 -translate-y-1/2 bg-surface pr-1 text-xs text-muted">{max}</span>
          <span className="absolute inset-x-0 bottom-0 border-t border-line-strong" />
          <div className="absolute inset-0 flex items-end gap-[3px] pl-6">
            {weeks.map((w) => {
              const total = w.staging + w.production
              return (
                <div key={w.week} className="group relative flex h-full flex-1 flex-col justify-end">
                  {w.staging > 0 && <span className="block rounded-t-[4px] bg-staging" style={{ height: `${(w.staging / max) * 100}%` }} />}
                  {w.staging > 0 && w.production > 0 && <span className="block h-[2px] shrink-0" />}
                  {w.production > 0 && (
                    <span className={`block bg-production ${w.staging ? '' : 'rounded-t-[4px]'}`} style={{ height: `${(w.production / max) * 100}%` }} />
                  )}
                  <span className="absolute inset-0 rounded-sm group-hover:bg-ink/5" />
                  <span className="pointer-events-none invisible absolute bottom-full left-1/2 z-10 mb-1 w-max -translate-x-1/2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs shadow-md group-hover:visible">
                    <span className="block font-semibold">Semana de {formatDate(w.week, false)}</span>
                    <span className="block text-ink-2">{w.staging} staging, {w.production} produção{w.hotfix ? ` (${w.hotfix} hotfix)` : ''}</span>
                    {total === 0 && <span className="block text-muted">Sem deploys</span>}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="mt-2 flex gap-[3px] pl-6 text-xs text-muted" aria-hidden="true">
          {weeks.map((w, i) => (
            <span key={w.week} className="flex-1 overflow-visible whitespace-nowrap">{i % labelEvery === 0 ? formatDate(w.week, false) : ''}</span>
          ))}
        </div>
        <table className="sr-only">
          <caption>Deploys por semana</caption>
          <thead><tr><th>Semana</th><th>Staging</th><th>Produção</th><th>Hotfix</th></tr></thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.week}><td>{formatDate(w.week)}</td><td>{w.staging}</td><td>{w.production}</td><td>{w.hotfix}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
