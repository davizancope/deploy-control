import { describe, expect, it } from 'vitest'
import type { BranchMerge } from './branch-graph'
import { currentProduction, type ProductionDeploy } from './production-branch'

const deploy = (branch: string | null): ProductionDeploy => ({ id: 'd1', code_version: 'WW_1019_RELEASE', branch, deployed_on: '2026-11-12' })
const merge = (id: string, branch: string, on: string, target = 'main'): BranchMerge => ({ id, branch, target_branch: target, merged_on: on })

describe('currentProduction', () => {
  it('devolve null quando nunca houve deploy em produção', () => {
    expect(currentProduction(null, [], 'main')).toBeNull()
  })

  it('traz a branch e o deploy, e merge nulo enquanto não foi mesclada', () => {
    const p = currentProduction(deploy('release/v1.9.0'), [merge('m1', 'release/v1.8.0', '2026-11-01')], 'main')!
    expect(p).toEqual({ deployId: 'd1', codeVersion: 'WW_1019_RELEASE', branch: 'release/v1.9.0', deployedOn: '2026-11-12', merge: null })
  })

  it('acha o merge no tronco, tratando master e main como o mesmo', () => {
    expect(currentProduction(deploy('release/v1.9.0'), [merge('m1', 'release/v1.9.0', '2026-11-14', 'master')], 'main')!.merge?.id).toBe('m1')
    expect(currentProduction(deploy('release/v1.9.0'), [merge('m1', 'release/v1.9.0', '2026-11-14', 'main')], 'master')!.merge?.id).toBe('m1')
  })

  it('ignora merge em outra branch e usa o primeiro merge no tronco', () => {
    const merges = [merge('a', 'release/v1.9.0', '2026-11-20', 'master'), merge('b', 'release/v1.9.0', '2026-11-13', 'main'), merge('c', 'release/v1.9.0', '2026-11-05', 'release/v1.10.0')]
    expect(currentProduction(deploy('release/v1.9.0'), merges, 'main')!.merge?.id).toBe('b')
    expect(currentProduction(deploy('release/v1.9.0'), [merges[2]], 'main')!.merge).toBeNull()
  })

  it('aceita deploy sem branch, sem merge', () => {
    expect(currentProduction(deploy('  '), [merge('m1', '', '2026-11-14')], 'main')).toMatchObject({ branch: null, merge: null })
  })
})
