import { describe, expect, it } from 'vitest'
import { buildBranchGraph, layoutBranchGraph, type BranchDeploy } from './branch-graph'

const d = (id: string, branch: string | null, date: string, extra: Partial<BranchDeploy> = {}): BranchDeploy => ({
  id,
  code_version: id,
  branch,
  source_branch: null,
  merged_branches: [],
  environment: 'staging',
  type: 'release',
  deployed_on: date,
  ...extra,
})

describe('buildBranchGraph', () => {
  it('liga origem e merge, sem duplicar arestas', () => {
    const g = buildBranchGraph([
      d('a', 'release/4.2.0', '2026-10-01', { source_branch: 'release/4.1.0' }),
      d('b', 'release/4.2.0', '2026-10-03', { source_branch: 'release/4.1.0', merged_branches: ['feature/x'], environment: 'production' }),
    ])
    expect(g.edges).toEqual([
      { from: 'release/4.1.0', to: 'release/4.2.0', kind: 'origin' },
      { from: 'feature/x', to: 'release/4.2.0', kind: 'merge' },
    ])
    const n = g.nodes.get('release/4.2.0')!
    expect(n.deploys).toHaveLength(2)
    expect(n.firstProductionOn).toBe('2026-10-03')
    expect(g.nodes.get('release/4.1.0')!.deploys).toHaveLength(0)
    expect(g.orphans).toEqual([])
  })

  it('separa branches sem nenhuma ligação', () => {
    const g = buildBranchGraph([d('a', 'solta', '2026-10-01'), d('b', 'filha', '2026-10-02', { source_branch: 'mae' }), d('c', null, '2026-10-02')])
    expect(g.orphans.map((n) => n.name)).toEqual(['solta'])
  })

  it('ignora auto-referência', () => {
    const g = buildBranchGraph([d('a', 'x', '2026-10-01', { source_branch: 'x', merged_branches: ['x'] })])
    expect(g.edges).toEqual([])
    expect(g.orphans.map((n) => n.name)).toEqual(['x'])
  })
})

describe('merges na master', () => {
  const merge = { id: 'm1', branch: 'release/4.2.0', target_branch: 'master', merged_on: '2026-10-10' }

  it('anexa o merge à branch e ignora branches fora do grafo', () => {
    const g = buildBranchGraph([d('a', 'release/4.2.0', '2026-10-01', { source_branch: 'master' })], [merge, { ...merge, id: 'm2', branch: 'outra' }])
    expect(g.nodes.get('release/4.2.0')!.merges.map((m) => m.id)).toEqual(['m1'])
    expect(g.nodes.has('outra')).toBe(false)
  })

  it('posiciona o retorno logo abaixo da branch, na mesma coluna, com uma aresta própria', () => {
    const g = buildBranchGraph([d('a', 'release/4.2.0', '2026-10-01', { source_branch: 'master' })], [merge])
    const l = layoutBranchGraph(g)
    const n = l.nodes.find((p) => p.name === 'release/4.2.0')!
    expect(l.returns).toHaveLength(1)
    expect(l.returns[0].x).toBe(n.x)
    expect(l.returns[0].y).toBeGreaterThan(n.y)
    expect(l.edges.filter((e) => e.kind === 'return')).toHaveLength(1)
    expect(l.height).toBeGreaterThan(n.y + 58)
  })

  it('reserva linhas para mais de um destino', () => {
    const g = buildBranchGraph(
      [d('a', 'x', '2026-10-01', { source_branch: 'master' }), d('b', 'y', '2026-10-02', { source_branch: 'x' })],
      [{ id: 'm1', branch: 'x', target_branch: 'master', merged_on: '2026-10-05' }, { id: 'm2', branch: 'x', target_branch: 'develop', merged_on: '2026-10-06' }],
    )
    const l = layoutBranchGraph(g)
    const ys = [...l.nodes.map((n) => n.y), ...l.returns.map((r) => r.y)]
    expect(new Set(ys.map((y, i) => `${y}|${i < l.nodes.length ? 'n' : 'r'}`)).size).toBe(ys.length)
    expect(l.nodes.find((n) => n.name === 'y')!.y).toBeGreaterThan(l.returns[1].y)
    expect(l.returns[1].y).toBeGreaterThan(l.returns[0].y)
  })
})

describe('layoutBranchGraph', () => {
  it('coloca cada branch numa coluna depois das suas origens', () => {
    const g = buildBranchGraph([
      d('a', 'b1', '2026-10-01', { source_branch: 'b0' }),
      d('b', 'b2', '2026-10-02', { source_branch: 'b1', merged_branches: ['hf'] }),
      d('c', 'hf', '2026-10-02', { source_branch: 'b0', type: 'hotfix' }),
    ])
    const l = layoutBranchGraph(g)
    const x = (n: string) => l.nodes.find((p) => p.name === n)!.x
    expect(x('b0')).toBeLessThan(x('b1'))
    expect(x('b1')).toBeLessThan(x('b2'))
    expect(x('hf')).toBeLessThan(x('b2'))
    expect(l.edges).toHaveLength(4)
  })

  it('não trava com ciclo', () => {
    const g = buildBranchGraph([d('a', 'x', '2026-10-01', { source_branch: 'y' }), d('b', 'y', '2026-10-02', { source_branch: 'x' })])
    expect(layoutBranchGraph(g).nodes).toHaveLength(2)
  })
})
