import Link from 'next/link'
import { Icon } from '@/components/icons'
import { daysBetween, formatDate, plural } from '@/lib/format'
import type { CurrentProduction } from '@/lib/production-branch'

/**
 * Etiqueta do topo com a branch que está em produção e se ela já foi mesclada no tronco; clicar nela seleciona a branch no mapa.
 * @param props.current Produção atual do projeto; null quando nunca houve deploy em produção.
 * @param props.trunk Nome do tronco (main ou master).
 * @param props.today Data de hoje (ISO).
 * @param props.href Link para selecionar a branch; sem ele a etiqueta não é um link.
 * @returns Etiqueta verde quando mesclada, âmbar quando ainda falta o merge e neutra quando não há o que mostrar.
 */
export function ProductionTag({ current, trunk, today, href }: { current: CurrentProduction | null; trunk: string; today: string; href: string | null }) {
  const base = 'inline-flex max-w-full flex-wrap items-center gap-x-2.5 gap-y-1 rounded-2xl border px-3.5 py-1.5 text-sm'
  if (!current) return <p className={`${base} border-line-strong bg-sunken text-ink-2`}>Nenhum deploy em produção neste projeto.</p>

  const days = Math.max(0, daysBetween(current.deployedOn, today))
  const tone = !current.branch ? 'border-line-strong bg-sunken' : current.merge ? 'border-production/30 bg-production-soft' : 'border-warn/40 bg-warn-soft'
  const label = (
    <>
      <span className="inline-flex items-center gap-1.5 font-medium text-ink-2">
        <span className="text-production"><Icon name="production" size={16} /></span>
        Em produção
      </span>
      <span className="code min-w-0 font-semibold break-all text-ink">{current.branch ?? current.codeVersion}</span>
      {!current.branch ? (
        <span className="text-ink-2">sem branch informada no deploy</span>
      ) : current.merge ? (
        <span className="inline-flex items-center gap-1.5 font-medium text-production">
          <Icon name="check" size={16} />
          Mesclada na {trunk} em {formatDate(current.merge.merged_on)}
        </span>
      ) : (
        <span className="font-medium text-warn">
          Ainda não mesclada na {trunk}
          <span className="font-normal">, em produção {days === 0 ? 'desde hoje' : `há ${plural(days, 'dia', 'dias')}`}</span>
        </span>
      )}
    </>
  )
  const title = `Deploy ${current.codeVersion}, ${formatDate(current.deployedOn)}`
  if (!current.branch || !href) return <p className={`${base} ${tone}`} title={title}>{label}</p>
  return <Link href={href} title={`${title}. Clique para ver a branch no mapa.`} className={`${base} ${tone} hover:border-ink`}>{label}</Link>
}
