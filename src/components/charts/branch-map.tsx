import Link from 'next/link'
import { Icon } from '@/components/icons'
import { EnvMark, TypeMark } from '@/components/ui'
import { NODE_H, NODE_W, type BranchLayout, type PositionedEdge, type PositionedNode, type PositionedReturn } from '@/lib/branch-graph'
import { formatDate, plural } from '@/lib/format'

/**
 * Mapa das branches ligadas: nós em HTML sobre um SVG com as linhas de origem (contínuas) e de merge (tracejadas).
 * @param props.layout Posições já calculadas.
 * @param props.selected Branch selecionada, realçada junto das suas linhas.
 * @param props.dimProduction Esmaece o que já foi para produção, para destacar o que ainda falta subir.
 * @param props.hrefFor Link de cada nó.
 * @returns Mapa rolável na horizontal.
 */
export function BranchMap({
  layout,
  selected,
  dimProduction,
  hrefFor,
}: {
  layout: BranchLayout
  selected: string
  dimProduction: boolean
  hrefFor: (branch: string) => string
}) {
  return (
    <div className="overflow-auto p-5">
      <div className="relative" style={{ width: layout.width, height: layout.height }}>
        <svg className="absolute inset-0" width={layout.width} height={layout.height} aria-hidden="true">
          {layout.edges.map((e) => (
            <EdgeLine key={`${e.kind}|${e.from}|${e.to}`} edge={e} selected={selected} />
          ))}
        </svg>
        {layout.returns.map((r) => (
          <ReturnCard key={r.key} item={r} dim={dimProduction} />
        ))}
        {layout.nodes.map((n) => (
          <NodeCard key={n.name} node={n} selected={n.name === selected} dim={dimProduction && Boolean(n.firstProductionOn)} href={hrefFor(n.name)} />
        ))}
      </div>
    </div>
  )
}

function EdgeLine({ edge: e, selected }: { edge: PositionedEdge; selected: string }) {
  const dx = Math.max(24, (e.x2 - e.x1) / 2)
  const touches = selected !== '' && (e.from === selected || e.to === selected)
  const faded = selected !== '' && !touches
  const stroke = touches ? 'var(--staging)' : e.kind === 'return' ? 'var(--production)' : 'var(--muted)'
  return (
    <g opacity={faded ? 0.18 : touches ? 1 : 0.6}>
      <path
        d={e.kind === 'return' ? `M${e.x1} ${e.y1} L${e.x2} ${e.y2}` : `M${e.x1} ${e.y1} C${e.x1 + dx} ${e.y1} ${e.x2 - dx} ${e.y2} ${e.x2} ${e.y2}`}
        fill="none"
        stroke={stroke}
        strokeWidth={touches ? 2 : 1.5}
        strokeDasharray={e.kind === 'merge' ? '5 5' : undefined}
        strokeLinecap="round"
      />
      <circle cx={e.x2} cy={e.y2} r="3" fill={stroke} />
    </g>
  )
}

function ReturnCard({ item: r, dim }: { item: PositionedReturn; dim: boolean }) {
  return (
    <div
      style={{ left: r.x, top: r.y, width: NODE_W, height: NODE_H, boxShadow: 'inset 0 0 0 999px var(--production-soft)' }}
      className={`absolute flex items-center gap-2.5 rounded-2xl border border-production/30 bg-pop px-3 ${dim ? 'opacity-40' : ''}`}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-production-soft text-production">
        <Icon name="merge" size={18} />
      </span>
      <span className="min-w-0">
        <span className="code block truncate text-sm font-medium" title={r.merge.target_branch}>{r.merge.target_branch}</span>
        <span className="block truncate text-xs text-production">Mesclada em {formatDate(r.merge.merged_on, false)}</span>
      </span>
    </div>
  )
}

function NodeCard({ node: n, selected, dim, href }: { node: PositionedNode; selected: boolean; dim: boolean; href: string }) {
  const deployed = n.deploys.length > 0
  const inProduction = Boolean(n.firstProductionOn)
  return (
    <Link
      href={href}
      aria-current={selected ? 'true' : undefined}
      style={{ left: n.x, top: n.y, width: NODE_W, height: NODE_H }}
      className={`absolute flex items-center gap-2.5 rounded-2xl border px-3 transition-opacity ${
        deployed ? 'border-line bg-pop shadow-[inset_0_1px_0_var(--glass-hi),0_6px_16px_-8px_var(--glass-shadow)]' : 'border-dashed border-line-strong bg-sunken'
      } ${selected ? 'outline-2 outline-offset-2 outline-[var(--staging)]' : 'hover:border-line-strong'} ${dim ? 'opacity-40 hover:opacity-100' : ''}`}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-sunken">
        {n.type ? <TypeMark type={n.type} size={18} /> : <span className="size-2 rounded-full border border-muted" />}
      </span>
      <span className="min-w-0">
        <span className="code block truncate text-sm font-medium" title={n.name}>{n.name}</span>
        <span className={`flex items-center gap-1 truncate text-xs ${inProduction ? 'text-production' : deployed ? 'text-staging' : 'text-muted'}`}>
          {deployed ? (
            <>
              <EnvMark env={inProduction ? 'production' : 'staging'} size={13} />
              {inProduction
                ? `Produção desde ${formatDate(n.firstProductionOn!, false)}`
                : `Só em staging, ${plural(n.deploys.length, 'deploy', 'deploys')}`}
            </>
          ) : (
            'Sem deploy no período'
          )}
        </span>
      </span>
    </Link>
  )
}
