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

export type BranchEdge = { from: string; to: string; kind: 'origin' | 'merge' }

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
  const link = (from: string, to: string, kind: BranchEdge['kind']) => {
    const key = `${kind}|${from}|${to}`
    if (from === to || edgeKeys.has(key)) return
    edgeKeys.add(key)
    touch(from)
    touch(to)
    edges.push({ from, to, kind })
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
    if (source) link(source, branch, 'origin')
    for (const m of d.merged_branches) {
      const merged = m.trim()
      if (merged) link(merged, branch, 'merge')
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

export const NODE_W = 244
export const NODE_H = 58
const GAP_X = 76
const GAP_Y = 14
const RETURN_STUB_X = 30

export type PositionedNode = BranchNode & { x: number; y: number }
export type PositionedEdge = { from: string; to: string; kind: BranchEdge['kind'] | 'return'; x1: number; y1: number; x2: number; y2: number }
/** Chegada de uma branch na master: nó logo abaixo da branch, na mesma coluna. */
export type PositionedReturn = { key: string; branch: string; merge: BranchMerge; x: number; y: number }
export type BranchLayout = { nodes: PositionedNode[]; edges: PositionedEdge[]; returns: PositionedReturn[]; width: number; height: number }

/**
 * Posiciona só as branches ligadas, da esquerda para a direita: a coluna é a maior distância desde uma raiz e cada branch ocupa uma linha, na ordem da árvore.
 * @param graph Grafo já montado.
 * @returns Posições em pixels, arestas com pontas e tamanho total.
 */
export function layoutBranchGraph(graph: BranchGraph): BranchLayout {
  const orphanNames = new Set(graph.orphans.map((n) => n.name))
  const names = [...graph.nodes.keys()].filter((n) => !orphanNames.has(n))
  const out = new Map<string, string[]>()
  const indeg = new Map<string, number>(names.map((n) => [n, 0]))
  for (const e of graph.edges) {
    if (!indeg.has(e.from) || !indeg.has(e.to)) continue
    out.set(e.from, [...(out.get(e.from) ?? []), e.to])
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1)
  }

  const depth = new Map<string, number>()
  const remaining = new Map(indeg)
  const queue = names.filter((n) => remaining.get(n) === 0)
  for (const n of queue) depth.set(n, 0)
  for (let i = 0; i < queue.length; i++) {
    const n = queue[i]
    for (const to of out.get(n) ?? []) {
      depth.set(to, Math.max(depth.get(to) ?? 0, (depth.get(n) ?? 0) + 1))
      remaining.set(to, (remaining.get(to) ?? 1) - 1)
      if (remaining.get(to) === 0) queue.push(to)
    }
  }
  // Branches presas em ciclo (dados inconsistentes) ficam na primeira coluna em vez de sumir.
  for (const n of names) if (!depth.has(n)) depth.set(n, 0)

  const sortKey = (n: string) => graph.nodes.get(n)!.deploys[0]?.deployed_on ?? '9999'
  const byAge = (a: string, b: string) => sortKey(a).localeCompare(sortKey(b)) || a.localeCompare(b)
  const order = new Map<string, number>()
  const visit = (n: string) => {
    if (order.has(n)) return
    order.set(n, order.size)
    for (const to of [...(out.get(n) ?? [])].sort(byAge)) visit(to)
  }
  for (const n of names.filter((x) => indeg.get(x) === 0).sort(byAge)) visit(n)
  for (const n of names.sort(byAge)) visit(n)

  // Cada branch ganha a própria linha (ordem da árvore), com uma linha extra para cada merge registrado, para nenhuma ligação atravessar outro nó.
  const pos = new Map<string, { x: number; y: number }>()
  const returns: PositionedReturn[] = []
  const returnEdges: PositionedEdge[] = []
  let row = 0
  for (const n of [...names].sort((a, b) => order.get(a)! - order.get(b)!)) {
    const x = depth.get(n)! * (NODE_W + GAP_X)
    const y = row * (NODE_H + GAP_Y)
    pos.set(n, { x, y })
    graph.nodes.get(n)!.merges.forEach((merge, i) => {
      const r = { key: `return|${merge.id}`, branch: n, merge, x, y: y + (i + 1) * (NODE_H + GAP_Y) }
      returns.push(r)
      returnEdges.push({ from: n, to: r.key, kind: 'return', x1: x + RETURN_STUB_X, y1: y + NODE_H, x2: x + RETURN_STUB_X, y2: r.y })
    })
    row += 1 + graph.nodes.get(n)!.merges.length
  }
  const cols = names.length ? Math.max(...depth.values()) + 1 : 0

  const nodes = names.map((n) => ({ ...graph.nodes.get(n)!, ...pos.get(n)! }))
  const edges: PositionedEdge[] = graph.edges
    .filter((e) => pos.has(e.from) && pos.has(e.to))
    .map((e): PositionedEdge => {
      const a = pos.get(e.from)!
      const b = pos.get(e.to)!
      return { ...e, x1: a.x + NODE_W, y1: a.y + NODE_H / 2, x2: b.x, y2: b.y + NODE_H / 2 }
    })
    .concat(returnEdges)
  return {
    nodes,
    edges,
    returns,
    width: cols ? cols * NODE_W + (cols - 1) * GAP_X : 0,
    height: row ? row * NODE_H + (row - 1) * GAP_Y : 0,
  }
}
