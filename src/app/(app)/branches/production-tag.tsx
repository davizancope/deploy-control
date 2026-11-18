import Link from 'next/link'
import { Icon } from '@/components/icons'
import { daysBetween, formatDate, plural } from '@/lib/format'
import type { CurrentProduction } from '@/lib/production-branch'

/**
 * Etiqueta em duas partes com a branch que está em produção: a esquerda é neutra (branch e desde quando) e a direita mostra o merge no tronco, verde com a data ou âmbar com os dias sem merge. Clicar nela seleciona a branch no mapa.
 * @param props.current Produção atual do projeto; null quando nunca houve deploy em produção.
 * @param props.trunk Nome do tronco (main ou master).
 * @param props.today Data de hoje (ISO).
 * @param props.href Link para selecionar a branch; sem ele a etiqueta não é um link.
 * @returns Etiqueta com o estado da produção atual.
 */
export function ProductionTag({ current, trunk, today, href }: { current: CurrentProduction | null; trunk: string; today: string; href: string | null }) {
  if (!current) {
    return <p className="inline-flex rounded-full border border-line-strong bg-sunken px-3.5 py-1.5 text-sm text-ink-2">Nenhum deploy em produção neste projeto.</p>
  }

  // O ano só aparece quando a data não é do ano corrente.
  const date = (iso: string) => formatDate(iso, iso.slice(0, 4) !== today.slice(0, 4))
  const days = Math.max(0, daysBetween(current.deployedOn, today))
  const box = 'inline-flex max-w-full flex-wrap overflow-hidden rounded-full border border-line-strong text-sm'
  const side = 'inline-flex items-center gap-2 px-3.5 py-1.5'

  const left = (
    <span className={`${side} bg-sunken`}>
      <span className="text-production"><Icon name="production" size={16} /></span>
      <span className="text-ink-2">{current.branch ? 'Produção atual' : 'Em produção'}</span>
      <span className="code min-w-0 font-semibold break-all text-ink">{current.branch ?? current.codeVersion}</span>
      <span className="text-muted" aria-hidden="true">·</span>
      <span className="text-ink-2">{days === 0 ? 'desde hoje' : `desde ${date(current.deployedOn)}`}</span>
    </span>
  )
  const right = !current.branch ? (
    <span className={`${side} border-l border-line-strong text-ink-2`}>Sem branch informada no deploy</span>
  ) : current.merge ? (
    <span className={`${side} border-l border-production/30 bg-production-soft font-medium text-production`}>
      <Icon name="check" size={16} />
      Mesclada na {trunk} em {date(current.merge.merged_on)}
    </span>
  ) : (
    <span className={`${side} border-l border-warn/40 bg-warn-soft font-medium text-warn`}>
      <Icon name="merge" size={16} />
      Sem merge na {trunk}{days > 0 && `, ${plural(days, 'dia', 'dias')}`}
    </span>
  )

  const title = `Deploy ${current.codeVersion}, ${formatDate(current.deployedOn)}`
  if (!current.branch || !href) return <p className={box} title={title}>{left}{right}</p>
  return <Link href={href} title={`${title}. Clique para ver a branch no mapa.`} className={`${box} hover:border-ink`}>{left}{right}</Link>
}
