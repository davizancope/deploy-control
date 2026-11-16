import { describe, expect, it } from 'vitest'
import { buildBranchGraph, detectTrunk, layoutBranchTimeline, type BranchDeploy, type BranchMerge } from './branch-graph'

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

const m = (id: string, branch: string, on: string, target = 'master'): BranchMerge => ({ id, branch, target_branch: target, merged_on: on })
const TODAY = '2026-11-04'

describe('buildBranchGraph', () => {
  it('liga origem e merge com a data do primeiro deploy, sem duplicar arestas', () => {
    const g = buildBranchGraph([
      d('a', 'release/4.2.0', '2026-10-01', { source_branch: 'release/4.1.0' }),
      d('b', 'release/4.2.0', '2026-10-03', { source_branch: 'release/4.1.0', merged_branches: ['feature/x'], environment: 'production' }),
    ])
    expect(g.edges).toEqual([
      { from: 'release/4.1.0', to: 'release/4.2.0', kind: 'origin', on: '2026-10-01' },
      { from: 'feature/x', to: 'release/4.2.0', kind: 'merge', on: '2026-10-03' },
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

  it('anexa o merge à branch e ignora branches fora do grafo', () => {
    const g = buildBranchGraph([d('a', 'release/4.2.0', '2026-10-01', { source_branch: 'master' })], [m('m1', 'release/4.2.0', '2026-10-10'), m('m2', 'outra', '2026-10-10')])
    expect(g.nodes.get('release/4.2.0')!.merges.map((x) => x.id)).toEqual(['m1'])
    expect(g.nodes.has('outra')).toBe(false)
  })
})

describe('detectTrunk', () => {
  it('usa o destino de merge mais registrado', () => {
    const g = buildBranchGraph(
      [d('a', 'x', '2026-10-01', { source_branch: 'main' }), d('b', 'y', '2026-10-02', { source_branch: 'main' })],
      [m('1', 'x', '2026-10-05', 'main'), m('2', 'y', '2026-10-06', 'main'), m('3', 'x', '2026-10-07', 'develop')],
    )
    expect(detectTrunk(g)).toBe('main')
  })

  it('sem merges, prefere master e depois main, e cai em master', () => {
    expect(detectTrunk(buildBranchGraph([d('a', 'x', '2026-10-01', { source_branch: 'main' })]))).toBe('main')
    expect(detectTrunk(buildBranchGraph([d('a', 'x', '2026-10-01', { source_branch: 'master' })]))).toBe('master')
    expect(detectTrunk(buildBranchGraph([d('a', 'x', '2026-10-01', { source_branch: 'y' })]))).toBe('master')
  })
})

/** Cenário dos wireframes: três releases, um hotfix direto na master e um bugfix filho de release com um hotfix filho dele. */
function scenario() {
  return buildBranchGraph(
    [
      d('r41a', 'release/4.1.0', '2026-10-03', { source_branch: 'master' }),
      d('r41b', 'release/4.1.0', '2026-10-10', { source_branch: 'master', environment: 'production' }),
      d('r42a', 'release/4.2.0', '2026-10-12', { source_branch: 'master' }),
      d('r42b', 'release/4.2.0', '2026-10-24', { source_branch: 'master', merged_branches: ['bugfix/promo'] }),
      d('r42c', 'release/4.2.0', '2026-10-28', { source_branch: 'master', environment: 'production' }),
      d('hf1', 'hotfix/checkout', '2026-10-19', { source_branch: 'master', type: 'hotfix' }),
      d('hf2', 'hotfix/checkout', '2026-10-21', { source_branch: 'master', type: 'hotfix', environment: 'production' }),
      d('bf1', 'bugfix/promo', '2026-10-18', { source_branch: 'release/4.2.0', type: 'bugfix' }),
      d('hr1', 'hotfix/arredonda', '2026-10-21', { source_branch: 'bugfix/promo', type: 'hotfix' }),
      d('hr2', 'hotfix/arredonda', '2026-10-25', { source_branch: 'bugfix/promo', type: 'hotfix', environment: 'production' }),
      d('r43a', 'release/4.3.0', '2026-10-31', { source_branch: 'master' }),
    ],
    [
      m('m1', 'release/4.1.0', '2026-10-14'),
      m('m2', 'hotfix/checkout', '2026-10-23'),
      m('m3', 'hotfix/arredonda', '2026-10-27'),
      m('m4', 'release/4.2.0', '2026-10-30'),
    ],
  )
}

describe('layoutBranchTimeline', () => {
  const t = layoutBranchTimeline(scenario(), { today: TODAY })
  const lane = (name: string) => t.lanes.find((l) => l.name === name)!

  it('usa a master como tronco e reaproveita a raia depois que a branch termina', () => {
    expect(t.trunk).toBe('master')
    expect(Object.fromEntries(t.lanes.map((l) => [l.name, l.index]))).toEqual({
      'release/4.1.0': 1,
      'hotfix/checkout': 1,
      'release/4.3.0': 1,
      'release/4.2.0': 2,
      'bugfix/promo': 3,
      'hotfix/arredonda': 4,
    })
  })

  it('põe cada filha abaixo da origem e começa a raia depois da curva de fork', () => {
    expect(lane('bugfix/promo').index).toBeGreaterThan(lane('release/4.2.0').index)
    expect(lane('hotfix/arredonda').index).toBeGreaterThan(lane('bugfix/promo').index)
    const fork = t.forks.find((f) => f.lane === 'release/4.2.0')!
    expect(lane('release/4.2.0').xStart).toBeGreaterThan(fork.x)
  })

  it('desenha o merge na master até o tronco e marca a data', () => {
    const link = t.links.find((l) => l.kind === 'merge' && l.lane === 'release/4.1.0')!
    expect(link.arrow).toBe(true)
    expect(link.d.endsWith(' 0')).toBe(true)
    expect(t.merges.map((x) => x.label)).toEqual(['14/10', '23/10', '27/10', '30/10'])
    const node = t.merges.find((x) => x.branch === 'release/4.1.0')!
    expect(lane('release/4.1.0').xEnd).toBeLessThan(node.x)
  })

  it('classifica o fim de cada raia', () => {
    expect(lane('release/4.1.0').end).toBe('merged')
    expect(lane('bugfix/promo').end).toBe('included')
    expect(lane('release/4.3.0').end).toBe('open')
    expect(t.links.find((l) => l.kind === 'include')!.target).toBe('release/4.2.0')
  })

  it('troca de azul para verde no primeiro deploy em produção', () => {
    const bars = lane('hotfix/checkout').bars
    expect(bars.map((b) => b.state)).toEqual(['staging', 'production'])
    expect(lane('hotfix/checkout').prodX).toBe(bars[1].x1)
    expect(lane('release/4.3.0').bars.every((b) => b.state === 'staging')).toBe(true)
  })

  it('abre folga na raia que a seta de merge atravessa', () => {
    const staging = lane('release/4.2.0').bars.filter((b) => b.state === 'staging')
    expect(staging).toHaveLength(2)
    expect(staging[1].x1 - staging[0].x2).toBeGreaterThan(0)
    expect(lane('release/4.1.0').bars.filter((b) => b.state === 'production')).toHaveLength(2)
    expect(lane('hotfix/checkout').bars).toHaveLength(2)
  })

  it('mede o corpo do mapa pelo número de raias', () => {
    expect(t.height).toBe(4 * 60 + 8)
    expect(t.width).toBeGreaterThan(t.todayX)
    expect(t.ticks.length).toBeGreaterThan(3)
  })
})

describe('fim de raia sem merge', () => {
  const only = (prodOn: string) => buildBranchGraph([d('a', 'x', '2026-09-20', { source_branch: 'master' }), d('b', 'x', prodOn, { source_branch: 'master', environment: 'production' })])

  it('avisa quando está em produção há muito tempo sem merge registrado', () => {
    const t = layoutBranchTimeline(only('2026-10-01'), { today: TODAY })
    expect(t.lanes[0].end).toBe('unmerged-prod')
    expect(t.lanes[0].xEnd).toBe(t.todayX)
    expect(t.lanes[0].title).toContain('sem merge registrado')
  })

  it('deixa a raia em produção sem merge abaixo das demais, sem folgas nas outras', () => {
    const g = buildBranchGraph([
      d('o1', 'release/4.0.0', '2026-09-20', { source_branch: 'master' }),
      d('o2', 'release/4.0.0', '2026-09-24', { source_branch: 'master', environment: 'production' }),
      d('n1', 'release/4.1.0', '2026-10-03', { source_branch: 'master' }),
    ], [m('1', 'release/4.1.0', '2026-10-14')])
    const t = layoutBranchTimeline(g, { today: TODAY })
    const old = t.lanes.find((l) => l.name === 'release/4.0.0')!
    const fresh = t.lanes.find((l) => l.name === 'release/4.1.0')!
    expect(old.end).toBe('unmerged-prod')
    expect(old.index).toBeGreaterThan(fresh.index)
    expect(fresh.index).toBe(1)
    expect(old.bars).toHaveLength(2)
  })

  it('segue aberta quando foi para produção há pouco', () => {
    expect(layoutBranchTimeline(only('2026-11-01'), { today: TODAY }).lanes[0].end).toBe('open')
  })
})

describe('outros destinos e dados incompletos', () => {
  it('liga merge em destino que não é raia a um marcador com o nome', () => {
    const g = buildBranchGraph([d('a', 'x', '2026-10-01', { source_branch: 'master' })], [m('1', 'x', '2026-10-05', 'master'), m('2', 'x', '2026-10-06', 'develop')])
    const t = layoutBranchTimeline(g, { today: TODAY })
    expect(t.stubs.map((s) => s.text)).toEqual(['develop'])
    expect(t.links.filter((l) => l.kind === 'stub')).toHaveLength(1)
  })

  it('dá raia à origem citada que nunca teve deploy, com a data dos filhos', () => {
    const g = buildBranchGraph([d('a', 'filha', '2026-10-10', { source_branch: 'release/x' })])
    const t = layoutBranchTimeline(g, { today: TODAY, trunk: 'master' })
    const mae = t.lanes.find((l) => l.name === 'release/x')!
    expect(mae.end).toBe('cited')
    expect(mae.bars.every((b) => b.state === 'none')).toBe(true)
    expect(t.lanes.find((l) => l.name === 'filha')!.index).toBeGreaterThan(mae.index)
  })

  it('deixa fora do mapa as branches sem ligação', () => {
    const g = buildBranchGraph([d('a', 'solta', '2026-10-01'), d('b', 'x', '2026-10-02', { source_branch: 'master' })])
    expect(layoutBranchTimeline(g, { today: TODAY }).lanes.map((l) => l.name)).toEqual(['x'])
  })

  it('não trava com ciclo de origens', () => {
    const g = buildBranchGraph([d('a', 'x', '2026-10-01', { source_branch: 'y' }), d('b', 'y', '2026-10-02', { source_branch: 'x' })])
    expect(layoutBranchTimeline(g, { today: TODAY }).lanes).toHaveLength(2)
  })

  it('devolve um mapa vazio sem branches ligadas', () => {
    const t = layoutBranchTimeline(buildBranchGraph([]), { today: TODAY })
    expect(t.lanes).toEqual([])
    expect(t.height).toBe(8)
  })
})
