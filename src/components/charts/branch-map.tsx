import Link from 'next/link'
import { HEADER_H, type BranchTimeline, type TimelineLane, type TimelineLink } from '@/lib/branch-graph'

const LINK_COLOR: Record<TimelineLink['kind'], string> = {
  fork: 'var(--muted)',
  merge: 'var(--production)',
  include: 'var(--ink-2)',
  stub: 'var(--ink-2)',
}
const BAR_COLOR: Record<TimelineLane['bars'][number]['state'], string> = {
  staging: 'var(--staging)',
  production: 'var(--production)',
  none: 'var(--line-strong)',
}
// Duas camadas de --pop (90% opaco) deixam o fundo do rótulo quase sólido, escondendo as linhas que passam atrás.
const LABEL_BG = 'linear-gradient(var(--pop), var(--pop))'

/**
 * Mapa de branches no tempo: o tronco é a linha fixa no topo e cada branch é uma raia que desce da origem (a filha logo sob o pai) e volta com uma seta no merge; o nome fica no fim da barra.
 * @param props.timeline Posições já calculadas.
 * @param props.selected Branch selecionada: ela, as origens até o tronco e os merges dela ficam em destaque.
 * @param props.dimProduction Esmaece o que já foi para produção, para destacar o que ainda falta subir.
 * @param props.hrefFor Link de cada branch.
 * @returns Mapa rolável, com eixo de datas e tronco presos ao topo.
 */
export function BranchMap({
  timeline: t,
  selected,
  dimProduction,
  hrefFor,
}: {
  timeline: BranchTimeline
  selected: string
  dimProduction: boolean
  hrefFor: (branch: string) => string
}) {
  const byName = new Map(t.lanes.map((l) => [l.name, l]))
  const focus = new Set<string>()
  for (let cur = byName.get(selected); cur && !focus.has(cur.name); cur = cur.parent ? byName.get(cur.parent) : undefined) focus.add(cur.name)
  const focused = focus.size > 0

  const laneOpacity = (l: TimelineLane) => (focused ? (focus.has(l.name) ? 1 : 0.3) : dimProduction && l.inProduction ? 0.4 : 1)
  const linkActive = (k: TimelineLink) => focused && (k.lane === selected || k.target === selected || (k.kind === 'fork' && focus.has(k.lane)))
  const linkOpacity = (k: TimelineLink) => (focused ? (linkActive(k) ? 1 : 0.25) : dimProduction && byName.get(k.lane)?.inProduction ? 0.4 : 0.75)
  const trunkForks = t.forks.filter((f) => f.y === 0)

  return (
    <div className="max-h-[70vh] overflow-auto">
      <div className="relative" style={{ width: t.width, minWidth: '100%' }}>
        <div className="sticky top-0 z-20 bg-[var(--pop-solid)]" style={{ height: HEADER_H }}>
          <svg className="absolute inset-0 overflow-visible" width={t.width} height={HEADER_H} aria-hidden="true">
            {t.ticks.map((k) => (
              <text key={k.x} x={k.x} y={18} textAnchor="middle" fontSize="12" fill="var(--muted)">{k.label}</text>
            ))}
            <line x1={t.todayX} x2={t.todayX} y1={26} y2={HEADER_H} stroke="var(--ink)" strokeWidth="2" strokeDasharray="4 4" opacity="0.45" />
            <text x={t.todayX} y={18} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--ink)">hoje</text>
            <rect x={0} y={HEADER_H - 3} width={t.todayX} height={6} rx={3} fill="var(--ink)" />
            {trunkForks.map((f) => (
              <circle key={f.key} cx={f.x} cy={HEADER_H} r={4} fill="var(--muted)" />
            ))}
            {t.merges.map((m) => (
              <g key={m.key}>
                <circle cx={m.x} cy={HEADER_H} r={6} fill="var(--production)" stroke="var(--pop)" strokeWidth="2" />
                {m.showLabel && <text x={m.x} y={HEADER_H - 14 - m.level * 13} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--production)">{m.label}</text>}
              </g>
            ))}
          </svg>
          <div className="pointer-events-none absolute left-0 flex w-full items-center" style={{ top: HEADER_H - 12, height: 24 }}>
            <Link
              href={hrefFor(t.trunk)}
              aria-current={selected === t.trunk ? 'true' : undefined}
              className="code pointer-events-auto sticky left-2 rounded-full bg-ink px-2.5 text-xs font-semibold leading-6 text-paper"
            >
              {t.trunk}
            </Link>
          </div>
        </div>

        <div className="relative" style={{ height: t.height }}>
          <svg className="absolute inset-0" width={t.width} height={t.height} aria-hidden="true">
            <defs>
              <marker id="bm-head-merge" orient="auto" markerWidth="5" markerHeight="5" refX="2" refY="2" overflow="visible">
                <path d="M0 0 L4 2 L0 4 Z" fill="var(--production)" />
              </marker>
              <marker id="bm-head-include" orient="auto" markerWidth="5" markerHeight="5" refX="2" refY="2" overflow="visible">
                <path d="M0 0 L4 2 L0 4 Z" fill="var(--ink-2)" />
              </marker>
            </defs>
            {t.ticks.map((k) => (
              <line key={k.x} x1={k.x} x2={k.x} y1={0} y2={t.height} stroke="var(--line)" />
            ))}
            <line x1={t.todayX} x2={t.todayX} y1={0} y2={t.height} stroke="var(--ink)" strokeWidth="2" strokeDasharray="4 4" opacity="0.35" />
            {t.links.map((k) => (
              <path
                key={k.key}
                d={k.d}
                fill="none"
                stroke={LINK_COLOR[k.kind]}
                strokeWidth={linkActive(k) ? 3 : 2}
                strokeLinecap="round"
                strokeDasharray={k.kind === 'include' || k.kind === 'stub' ? '5 4' : undefined}
                markerEnd={k.arrow ? (k.kind === 'merge' ? 'url(#bm-head-merge)' : 'url(#bm-head-include)') : undefined}
                opacity={linkOpacity(k)}
              />
            ))}
            {t.lanes.map((l) => {
              const isSelected = l.name === selected
              return (
                <g key={l.name} opacity={laneOpacity(l)}>
                  {isSelected && <rect x={l.xStart - 4} y={l.y - 7} width={Math.max(l.xEnd - l.xStart, 0) + 8} height={14} rx={7} fill="none" stroke="var(--ink)" strokeWidth="1.5" />}
                  {l.bars.map((b) => (
                    <rect key={`${b.x1}|${b.state}`} x={b.x1} y={l.y - (isSelected ? 3 : 2)} width={b.x2 - b.x1} height={isSelected ? 6 : 4} rx={2} fill={BAR_COLOR[b.state]} />
                  ))}
                  {l.prodX !== null && <circle cx={l.prodX} cy={l.y} r={5} fill="var(--production)" stroke="var(--pop)" strokeWidth="2" />}
                  {l.end === 'open' && <circle cx={l.xEnd} cy={l.y} r={6} fill="var(--pop)" stroke="var(--staging)" strokeWidth="2" />}
                  {l.end === 'covered' && <line x1={l.xEnd} x2={l.xEnd} y1={l.y - 6} y2={l.y + 6} stroke="var(--ink-2)" strokeWidth="2" strokeLinecap="round" />}
                  {l.end === 'unmerged-prod' && (
                    <g>
                      <circle cx={l.xEnd} cy={l.y} r={9} fill="var(--pop)" stroke="var(--warn)" strokeWidth="2" />
                      <text x={l.xEnd} y={l.y + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--warn)">?</text>
                    </g>
                  )}
                </g>
              )
            })}
            {t.forks.filter((f) => f.y !== 0).map((f) => (
              <circle key={f.key} cx={f.x} cy={f.y} r={3.5} fill="var(--muted)" opacity={linkOpacity({ lane: f.lane, kind: 'fork', target: '' } as TimelineLink)} />
            ))}
            {t.stubs.map((s) => (
              <text key={s.key} x={s.x} y={s.y + 4} fontSize="12" fill="var(--ink-2)" stroke="var(--pop)" strokeWidth="5" strokeLinejoin="round" paintOrder="stroke" className="code" opacity={laneOpacity(byName.get(s.lane)!)}>{s.text}</text>
            ))}
          </svg>
          {t.lanes.map((l) => (
            <div key={l.name} style={{ opacity: laneOpacity(l) }}>
              <Link
                href={hrefFor(l.name)}
                aria-hidden="true"
                tabIndex={-1}
                className="absolute block"
                style={{ left: l.xStart, top: l.y - 8, width: Math.max(l.xEnd - l.xStart, 14), height: 16 }}
              />
              <Link
                href={hrefFor(l.name)}
                title={l.title}
                aria-current={l.name === selected ? 'true' : undefined}
                className={`code absolute block whitespace-nowrap rounded bg-[var(--pop)] px-0.5 text-xs leading-[18px] hover:underline ${l.name === selected ? 'lift font-semibold' : ''} ${l.end === 'cited' ? 'italic text-muted' : ''}`}
                style={{ left: l.label.x, top: l.label.y, width: l.label.width, height: 18, backgroundImage: LABEL_BG }}
              >
                {l.name}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
