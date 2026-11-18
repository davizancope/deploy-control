import { addDays, daysBetween, formatDate, isoToDate } from '@/lib/format'
import type { DeployType, Environment } from '@/lib/types'

export type BranchDeploy = {
  id: string
  code_version: string
  branch: string | null
  source_branch: string | null
  merged_branches: string[]
  environment: Environment
  type: DeployType
  deployed_on: string
}

export type BranchMerge = { id: string; branch: string; target_branch: string; merged_on: string }

export type BranchNode = {
  name: string
  /** Deploys desta branch, do mais antigo ao mais recente; vazio quando só foi citada como origem ou merge. */
  deploys: BranchDeploy[]
  /** Tipo do deploy mais recente; null quando a branch nunca subiu. */
  type: DeployType | null
  firstProductionOn: string | null
  lastDeployedOn: string | null
  /** Merges desta branch na master (ou outro destino), do mais antigo ao mais recente. */
  merges: BranchMerge[]
}

/** `on` é a data do primeiro deploy de `to` que citou a ligação; serve de data de fork (origin) ou de inclusão (merge). */
export type BranchEdge = { from: string; to: string; kind: 'origin' | 'merge'; on: string }

export type BranchGraph = {
  nodes: Map<string, BranchNode>
  edges: BranchEdge[]
  /** Branches que subiram e não têm origem, merge nem filhas informados. */
  orphans: BranchNode[]
}

/**
 * Monta o grafo de branches de um projeto: cada branch é um nó, "criada a partir da" vira aresta de origem e "mesclada" vira aresta de merge.
 * @param deploys Deploys do projeto.
 * @param merges Merges registrados na master; os de branches que não estão no grafo são ignorados.
 * @returns Nós, arestas (sem duplicatas) e branches sem nenhuma ligação.
 */
export function buildBranchGraph(deploys: BranchDeploy[], merges: BranchMerge[] = []): BranchGraph {
  const nodes = new Map<string, BranchNode>()
  const edgeKeys = new Set<string>()
  const edges: BranchEdge[] = []
  const touch = (name: string) => {
    let n = nodes.get(name)
    if (!n) {
      n = { name, deploys: [], type: null, firstProductionOn: null, lastDeployedOn: null, merges: [] }
      nodes.set(name, n)
    }
    return n
  }
  const link = (from: string, to: string, kind: BranchEdge['kind'], on: string) => {
    const key = `${kind}|${from}|${to}`
    if (from === to || edgeKeys.has(key)) return
    edgeKeys.add(key)
    touch(from)
    touch(to)
    edges.push({ from, to, kind, on })
  }

  const ordered = [...deploys].sort((a, b) => a.deployed_on.localeCompare(b.deployed_on) || a.id.localeCompare(b.id))
  for (const d of ordered) {
    const branch = d.branch?.trim()
    if (!branch) continue
    const node = touch(branch)
    node.deploys.push(d)
    node.type = d.type
    node.lastDeployedOn = d.deployed_on
    if (d.environment === 'production' && !node.firstProductionOn) node.firstProductionOn = d.deployed_on
    const source = d.source_branch?.trim()
    if (source) link(source, branch, 'origin', d.deployed_on)
    for (const m of d.merged_branches) {
      const merged = m.trim()
      if (merged) link(merged, branch, 'merge', d.deployed_on)
    }
  }

  for (const m of [...merges].sort((a, b) => a.merged_on.localeCompare(b.merged_on) || a.id.localeCompare(b.id))) {
    nodes.get(m.branch.trim())?.merges.push(m)
  }

  const connected = new Set<string>()
  for (const e of edges) {
    connected.add(e.from)
    connected.add(e.to)
  }
  const orphans = [...nodes.values()]
    .filter((n) => n.deploys.length > 0 && !connected.has(n.name))
    .sort((a, b) => (b.lastDeployedOn ?? '').localeCompare(a.lastDeployedOn ?? ''))
  return { nodes, edges, orphans }
}

export const HEADER_H = 64
export const LANE_H = 60
const X0 = 100
const CURVE = 14
const HOP = 10
const LABEL_CHAR = 7.3
const UNMERGED_DAYS = 14

export type TimelineState = 'staging' | 'production' | 'none'
export type TimelineEnd = 'merged' | 'included' | 'stub' | 'open' | 'unmerged-prod' | 'covered' | 'cited'
export type TimelineBar = { x1: number; x2: number; state: TimelineState }
export type TimelineLane = {
  name: string
  type: DeployType | null
  index: number
  y: number
  parent: string | null
  xStart: number
  xEnd: number
  prodX: number | null
  bars: TimelineBar[]
  end: TimelineEnd
  label: { x: number; y: number; width: number }
  inProduction: boolean
  title: string
}
export type TimelineLink = { key: string; kind: 'fork' | 'merge' | 'include' | 'stub'; lane: string; target: string; d: string; arrow: boolean }
export type TimelineStub = { key: string; lane: string; x: number; y: number; text: string }
/** `level` 0 é a linha de baixo do cabeçalho; 1 é a de cima, usada quando o rótulo vizinho está perto demais. */
export type TimelineMerge = { key: string; branch: string; x: number; label: string; showLabel: boolean; level: 0 | 1 }
export type TimelineFork = { key: string; lane: string; x: number; y: number }
export type TimelineTick = { x: number; label: string }
export type BranchTimeline = {
  trunk: string
  width: number
  height: number
  todayX: number
  ticks: TimelineTick[]
  lanes: TimelineLane[]
  links: TimelineLink[]
  stubs: TimelineStub[]
  merges: TimelineMerge[]
  forks: TimelineFork[]
}

const TRUNK_NAMES = ['master', 'main']

/**
 * Descobre qual branch é o tronco do projeto: o destino de merge mais registrado (master e main contam juntas, porque o tronco pode ter trocado de nome), ou master/main quando ainda não há merges.
 * @param graph Grafo já montado.
 * @returns Nome do tronco (master quando nada indica outro).
 */
export function detectTrunk(graph: BranchGraph): string {
  const counts = new Map<string, number>()
  for (const n of graph.nodes.values()) for (const m of n.merges) counts.set(m.target_branch, (counts.get(m.target_branch) ?? 0) + 1)
  const rank = (name: string) => (name === 'master' ? 0 : name === 'main' ? 1 : 2)
  const weight = (name: string) => (TRUNK_NAMES.includes(name) ? TRUNK_NAMES.reduce((sum, t) => sum + (counts.get(t) ?? 0), 0) : (counts.get(name) ?? 0))
  const ranked = [...counts.entries()].sort((a, b) => weight(b[0]) - weight(a[0]) || b[1] - a[1] || rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]))
  if (ranked.length > 0) return ranked[0][0]
  for (const name of ['master', 'main']) if (graph.nodes.has(name)) return name
  return 'master'
}

/**
 * Valor de uma Bézier cúbica numa dimensão.
 * @param a Ponto inicial.
 * @param b Primeiro controle.
 * @param c Segundo controle.
 * @param d Ponto final.
 * @param t Parâmetro de 0 a 1.
 * @returns Coordenada em t.
 */
function bezier(a: number, b: number, c: number, d: number, t: number): number {
  const u = 1 - t
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d
}

type Curve = { x0: number; y0: number; x1: number; y1: number; c1: number; c2: number }

/**
 * Descreve uma curva em S que sai horizontal e chega horizontal.
 * @param x0 X inicial.
 * @param y0 Y inicial.
 * @param x1 X final.
 * @param y1 Y final.
 * @param k1 Fração do vão em X onde fica o primeiro controle.
 * @param k2 Fração do vão em X onde fica o segundo controle.
 * @returns Curva com os dois controles.
 */
function curveOf(x0: number, y0: number, x1: number, y1: number, k1: number, k2: number): Curve {
  return { x0, y0, x1, y1, c1: x0 + (x1 - x0) * k1, c2: x0 + (x1 - x0) * k2 }
}

/**
 * Converte a curva em path SVG.
 * @param c Curva.
 * @returns Atributo `d`.
 */
function pathOf(c: Curve): string {
  return `M${c.x0} ${c.y0} C${c.c1} ${c.y0} ${c.c2} ${c.y1} ${c.x1} ${c.y1}`
}

/**
 * Acha o X da curva numa altura (a curva é monótona em Y).
 * @param c Curva.
 * @param y Altura procurada.
 * @returns X em que a curva passa por y.
 */
function xAtY(c: Curve, y: number): number {
  const down = c.y1 >= c.y0
  let lo = 0
  let hi = 1
  for (let i = 0; i < 28; i++) {
    const t = (lo + hi) / 2
    if ((bezier(c.y0, c.y0, c.y1, c.y1, t) < y) === down) lo = t
    else hi = t
  }
  return bezier(c.x0, c.c1, c.c2, c.x1, (lo + hi) / 2)
}

/**
 * Tira de um trecho horizontal as folgas onde outras setas o cruzam.
 * @param x1 Início do trecho.
 * @param x2 Fim do trecho.
 * @param gaps Centros das folgas.
 * @returns Pedaços que sobram, em ordem.
 */
function cutGaps(x1: number, x2: number, gaps: number[]): Array<[number, number]> {
  const out: Array<[number, number]> = []
  let from = x1
  for (const g of [...gaps].sort((a, b) => a - b)) {
    if (g + HOP / 2 <= from || g - HOP / 2 >= x2) continue
    if (g - HOP / 2 > from) out.push([from, g - HOP / 2])
    from = Math.max(from, g + HOP / 2)
  }
  if (from < x2) out.push([from, x2])
  return out
}

/**
 * Marcas do eixo de tempo: segundas-feiras quando há espaço, senão o dia 1 de cada mês.
 * @param min Primeiro dia do eixo.
 * @param max Último dia do eixo.
 * @param pxPerDay Pixels por dia.
 * @param x Conversor de data para X.
 * @returns Marcas com rótulo curto.
 */
function buildTicks(min: string, max: string, pxPerDay: number, x: (iso: string) => number): TimelineTick[] {
  const weekly = pxPerDay >= 14
  const ticks: TimelineTick[] = []
  const days = daysBetween(min, max)
  for (let i = 0; i <= days; i++) {
    const d = addDays(min, i)
    const monday = isoToDate(d).getUTCDay() === 1
    const first = d.slice(8, 10) === '01'
    if (weekly ? !monday : !first) continue
    const dayOfMonth = Number(d.slice(8, 10))
    const label = weekly ? (ticks.length === 0 || dayOfMonth <= 7 ? formatDate(d, false) : String(dayOfMonth)) : formatDate(d, d.slice(5, 7) === '01')
    ticks.push({ x: x(d), label })
  }
  return ticks
}

type MergeLink = { target: string; on: string; kind: 'trunk' | 'include' | 'stub' }

/**
 * Posiciona as branches ligadas num mapa de tempo: o tronco é a linha de cima e cada branch ganha uma raia abaixo da sua origem (a filha logo sob o pai, em escada), reaproveitada depois que a anterior termina. O nome fica sempre no fim da barra, longe dos conectores. Master e main contam como o mesmo tronco.
 * @param graph Grafo já montado.
 * @param opts.today Data de hoje (ISO): fim das raias abertas.
 * @param opts.trunk Nome do tronco; quando omitido é descoberto pelos merges.
 * @returns Raias, setas, marcas e o tamanho do corpo do mapa em pixels.
 */
export function layoutBranchTimeline(graph: BranchGraph, opts: { today: string; trunk?: string }): BranchTimeline {
  const { today } = opts
  const trunk = opts.trunk ?? detectTrunk(graph)
  const isTrunk = (n: string) => n === trunk || (TRUNK_NAMES.includes(n) && TRUNK_NAMES.includes(trunk))
  const orphanNames = new Set(graph.orphans.map((n) => n.name))
  const names = [...graph.nodes.keys()].filter((n) => !isTrunk(n) && !orphanNames.has(n))
  const inSet = new Set(names)

  const parent = new Map<string, string | null>()
  const children = new Map<string, string[]>()
  for (const n of names) {
    const e = graph.edges.find((x) => x.kind === 'origin' && x.to === n && (isTrunk(x.from) || inSet.has(x.from)))
    const from = e ? (isTrunk(e.from) ? trunk : e.from) : null
    parent.set(n, from)
    if (from && from !== trunk) children.set(from, [...(children.get(from) ?? []), n])
  }

  const outLinks = new Map<string, MergeLink[]>()
  for (const n of names) {
    const found: MergeLink[] = []
    const add = (target: string, on: string) => {
      const kind: MergeLink['kind'] = isTrunk(target) ? 'trunk' : inSet.has(target) ? 'include' : 'stub'
      if (target === n || found.some((l) => l.target === target || (kind === 'trunk' && l.kind === 'trunk'))) return
      found.push({ target: kind === 'trunk' ? trunk : target, on, kind })
    }
    for (const m of graph.nodes.get(n)!.merges) add(m.target_branch, m.merged_on)
    for (const e of graph.edges) if (e.kind === 'merge' && e.from === n) add(e.to, e.on)
    outLinks.set(n, found)
  }

  /** Filha mais próxima que voltou para o tronco: o merge dela leva junto os commits desta branch. */
  const coveredBy = (n: string): string | null => {
    const seen = new Set<string>([n])
    const queue = [...(children.get(n) ?? [])]
    for (let c = queue.shift(); c !== undefined; c = queue.shift()) {
      if (seen.has(c)) continue
      seen.add(c)
      if ((outLinks.get(c) ?? []).some((l) => l.kind === 'trunk')) return c
      queue.push(...(children.get(c) ?? []))
    }
    return null
  }

  const startMemo = new Map<string, string>()
  const startOf = (n: string, seen: Set<string> = new Set()): string => {
    const memo = startMemo.get(n)
    if (memo) return memo
    seen.add(n)
    const dates: string[] = []
    const first = graph.nodes.get(n)!.deploys[0]?.deployed_on
    if (first) dates.push(first)
    for (const l of outLinks.get(n) ?? []) dates.push(l.on)
    for (const c of children.get(n) ?? []) if (!seen.has(c)) dates.push(startOf(c, seen))
    const start = dates.sort()[0] ?? today
    startMemo.set(n, start)
    return start
  }

  const earliest = names.map((n) => startOf(n)).sort()[0]
  const minDate = earliest && earliest < today ? addDays(earliest, -3) : addDays(today, -14)
  const totalDays = Math.max(14, daysBetween(minDate, today))
  const pxPerDay = Math.max(8, Math.min(24, Math.floor(900 / totalDays)))
  const x = (iso: string) => X0 + daysBetween(minDate, iso) * pxPerDay
  const todayX = x(today)

  type Plan = {
    name: string
    node: BranchNode
    xf: number
    xs: number
    barEnd: number
    end: TimelineEnd
    links: Array<MergeLink & { cs: number; ce: number }>
    label: TimelineLane['label']
    coveredBy: string | null
    left: number
    right: number
  }
  const plans = new Map<string, Plan>()
  for (const n of names) {
    const node = graph.nodes.get(n)!
    const hasParent = parent.get(n) !== null
    const xf = x(startOf(n))
    const xs = hasParent ? xf + CURVE : xf
    const links = (outLinks.get(n) ?? []).map((l) => {
      const ce = l.kind === 'trunk' ? x(l.on) - 12 : l.kind === 'include' ? x(l.on) - 4 : x(l.on)
      return { ...l, ce, cs: l.kind === 'stub' ? ce : ce - CURVE }
    })
    const childForkX = (children.get(n) ?? []).map((c) => x(startOf(c)))
    const hasDeploys = node.deploys.length > 0
    const covered = hasDeploys ? coveredBy(n) : null
    let end: TimelineEnd
    if (links.some((l) => l.kind === 'trunk')) end = 'merged'
    else if (links.some((l) => l.kind === 'include')) end = 'included'
    else if (links.length > 0) end = 'stub'
    else if (!hasDeploys) end = 'cited'
    else if (covered) end = 'covered'
    else if (node.firstProductionOn && daysBetween(node.firstProductionOn, today) > UNMERGED_DAYS) end = 'unmerged-prod'
    else end = 'open'
    let barEnd = xs
    if (links.length > 0) barEnd = Math.max(barEnd, ...links.map((l) => l.cs))
    else if (end === 'open' || end === 'unmerged-prod') barEnd = Math.max(barEnd, todayX)
    else if (node.lastDeployedOn) barEnd = Math.max(barEnd, x(node.lastDeployedOn))
    if (childForkX.length > 0) barEnd = Math.max(barEnd, ...childForkX)
    // O tracinho de fim não pode cair em cima da bolinha de produção quando o último deploy é o primeiro em produção.
    if (end === 'covered' && node.firstProductionOn) barEnd = Math.max(barEnd, x(node.firstProductionOn) + 12)

    const labelW = n.length * LABEL_CHAR + 6
    const capEnd = end === 'open' ? 6 : end === 'unmerged-prod' ? 9 : end === 'covered' ? 2 : 0
    const linkEnd = links.length > 0 ? Math.max(...links.map((l) => (l.kind === 'stub' ? l.cs + 32 + l.target.length * 6.5 : l.ce))) : barEnd
    const labelX = Math.max(barEnd + capEnd, linkEnd) + 10
    const right = labelX + labelW + 6
    plans.set(n, { name: n, node, xf, xs, barEnd, end, links, label: { x: labelX, y: 0, width: labelW }, coveredBy: covered, left: xf - 4, right })
  }

  const laneOf = new Map<string, number>()
  const occupied: Array<Array<[number, number]>> = []
  const visiting = new Set<string>()
  let floor = 1
  const place = (n: string) => {
    if (laneOf.has(n) || visiting.has(n)) return
    visiting.add(n)
    const p = parent.get(n) ?? null
    let k = floor
    if (p && p !== trunk) {
      place(p)
      k = (laneOf.get(p) ?? 0) + 1
    }
    const { left, right } = plans.get(n)!
    while ((occupied[k] ?? []).some(([l, r]) => left < r + 8 && right > l - 8)) k++
    occupied[k] = [...(occupied[k] ?? []), [left, right]]
    laneOf.set(n, k)
  }
  // Raias longas em produção sem merge ficam no fim: assim as setas das demais não precisam cruzá-las.
  const rootOf = (n: string): string => {
    const seen = new Set<string>()
    let cur = n
    while (!seen.has(cur)) {
      seen.add(cur)
      const p = parent.get(cur)
      if (!p || p === trunk) return cur
      cur = p
    }
    return cur
  }
  const late = (n: string) => plans.get(rootOf(n))!.end === 'unmerged-prod'
  const byStart = [...names].sort((a, b) => plans.get(a)!.xf - plans.get(b)!.xf || a.localeCompare(b))
  // Em árvore: cada branch vem seguida das filhas, para a filha cair logo abaixo e o fork ficar curto; sobras de ciclo entram por data.
  const order: string[] = []
  const queued = new Set<string>()
  const enqueue = (n: string) => {
    if (queued.has(n)) return
    queued.add(n)
    order.push(n)
    const kids = [...(children.get(n) ?? [])].sort((a, b) => plans.get(a)!.xf - plans.get(b)!.xf || a.localeCompare(b))
    for (const c of kids) enqueue(c)
  }
  for (const n of byStart) if (parent.get(n) === null || parent.get(n) === trunk) enqueue(n)
  for (const n of byStart) enqueue(n)
  for (const n of order.filter((x) => !late(x))) place(n)
  floor = Math.max(1, ...laneOf.values()) + 1
  for (const n of order.filter(late)) place(n)

  const laneY = (k: number) => k * LANE_H - 12
  const yOf = (n: string) => (n === trunk ? 0 : laneY(laneOf.get(n)!))
  const gaps = new Map<string, number[]>()
  const links: TimelineLink[] = []
  const stubs: TimelineStub[] = []
  const merges: TimelineMerge[] = []
  const forks: TimelineFork[] = []
  const crossings: Array<{ lane: string; target: string; curve: Curve }> = []

  for (const n of names) {
    const pl = plans.get(n)!
    const y = yOf(n)
    const p = parent.get(n) ?? null
    if (p) {
      const c = curveOf(pl.xf, yOf(p), pl.xs, y, 0.5, 0.5)
      links.push({ key: `fork|${p}|${n}`, kind: 'fork', lane: n, target: p, d: pathOf(c), arrow: false })
      forks.push({ key: `forkdot|${p}|${n}`, lane: n, x: pl.xf, y: yOf(p) })
      crossings.push({ lane: n, target: p, curve: c })
    }
    for (const l of pl.links) {
      if (l.kind === 'stub') {
        links.push({ key: `stub|${n}|${l.target}`, kind: 'stub', lane: n, target: l.target, d: `M${l.cs} ${y} L${l.cs + 24} ${y}`, arrow: true })
        stubs.push({ key: `stubtext|${n}|${l.target}`, lane: n, x: l.cs + 32, y, text: l.target })
        continue
      }
      const ty = l.kind === 'trunk' ? 0 : yOf(l.target)
      const c = curveOf(l.cs, y, l.ce, ty, 0.55, 0.45)
      links.push({ key: `${l.kind}|${n}|${l.target}`, kind: l.kind === 'trunk' ? 'merge' : 'include', lane: n, target: l.target, d: pathOf(c), arrow: true })
      crossings.push({ lane: n, target: l.target, curve: c })
      if (l.kind === 'trunk') merges.push({ key: `node|${n}`, branch: n, x: x(l.on), label: `${l.on.slice(8, 10)}/${l.on.slice(5, 7)}`, showLabel: true, level: 0 })
    }
  }

  for (const cr of crossings) {
    const lo = Math.min(cr.curve.y0, cr.curve.y1)
    const hi = Math.max(cr.curve.y0, cr.curve.y1)
    for (const n of names) {
      const y = yOf(n)
      if (y <= lo + 1 || y >= hi - 1) continue
      const at = xAtY(cr.curve, y)
      const pl = plans.get(n)!
      if (at >= pl.xs - 2 && at <= pl.barEnd + 2) gaps.set(n, [...(gaps.get(n) ?? []), at])
    }
  }

  merges.sort((a, b) => a.x - b.x)
  const lastX = [-Infinity, -Infinity]
  for (const m of merges) {
    const level = lastX.findIndex((lx) => m.x - lx >= 40)
    m.showLabel = level >= 0
    if (level >= 0) {
      m.level = level === 1 ? 1 : 0
      lastX[level] = m.x
    }
  }

  const lanes: TimelineLane[] = names
    .map((n): TimelineLane => {
      const pl = plans.get(n)!
      const node = pl.node
      const y = yOf(n)
      const prodX = node.firstProductionOn ? Math.min(Math.max(x(node.firstProductionOn), pl.xs), pl.barEnd) : null
      const cuts = (x1: number, x2: number, state: TimelineState): TimelineBar[] => cutGaps(x1, x2, gaps.get(n) ?? []).map(([a, b]) => ({ x1: a, x2: b, state }))
      let bars: TimelineBar[]
      if (node.deploys.length === 0) bars = cuts(pl.xs, pl.barEnd, 'none')
      else if (prodX === null) bars = cuts(pl.xs, pl.barEnd, 'staging')
      else bars = [...cuts(pl.xs, prodX, 'staging'), ...cuts(prodX, pl.barEnd, 'production')]
      const parts: string[] = []
      if (node.firstProductionOn) parts.push(`em produção desde ${formatDate(node.firstProductionOn)}`)
      else if (node.deploys.length > 0) parts.push('só em staging')
      for (const l of pl.links) parts.push(`${l.kind === 'include' ? 'incluída em' : 'mesclada em'} ${l.target}, ${formatDate(l.on)}`)
      if (pl.end === 'covered') parts.push(`sem merge próprio: coberta pelo merge de ${pl.coveredBy} na ${trunk}`)
      if (pl.end === 'unmerged-prod') parts.push(`sem merge registrado há mais de ${UNMERGED_DAYS} dias em produção`)
      return {
        name: n,
        type: node.type,
        index: laneOf.get(n)!,
        y,
        parent: parent.get(n) ?? null,
        xStart: pl.xs,
        xEnd: pl.barEnd,
        prodX,
        bars,
        end: pl.end,
        label: { x: pl.label.x, y: y - 9, width: pl.label.width },
        inProduction: node.firstProductionOn !== null,
        title: parts.length > 0 ? `${n}: ${parts.join('; ')}` : n,
      }
    })
    .sort((a, b) => a.index - b.index || a.xStart - b.xStart)

  const laneCount = lanes.reduce((m, l) => Math.max(m, l.index), 0)
  const rightmost = Math.max(todayX, ...[...plans.values()].map((p) => p.right), ...stubs.map((s) => s.x + s.text.length * 6.5 + 8))
  return {
    trunk,
    width: Math.ceil(rightmost + 40),
    height: laneCount * LANE_H + 8,
    todayX,
    ticks: buildTicks(minDate, today, pxPerDay, x),
    lanes,
    links,
    stubs,
    merges,
    forks,
  }
}
