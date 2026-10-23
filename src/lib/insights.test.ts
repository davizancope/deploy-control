import { describe, expect, it } from 'vitest'
import { computeInsights, type DashDeploy, type DashTask } from './insights'

const d = (id: string, env: 'staging' | 'production', date: string, type: 'release' | 'hotfix' = 'release'): DashDeploy => ({
  id,
  project_id: 'p1',
  project_name: 'Projeto',
  code_version: id,
  environment: env,
  type,
  deployed_on: date,
})

describe('computeInsights', () => {
  it('calcula hotfix, lead time, espera e retrabalho', () => {
    const deploys = [d('a', 'staging', '2026-10-01'), d('b', 'production', '2026-10-05'), d('c', 'production', '2026-10-06', 'hotfix')]
    const tasks: DashTask[] = [
      { task_key: 'A-1', project_id: 'p1', first_staging_on: '2026-10-01', first_production_on: '2026-10-05', staging_deploys: 1, production_deploys: 1, last_deployed_on: '2026-10-05' },
      { task_key: 'A-2', project_id: 'p1', first_staging_on: '2026-09-20', first_production_on: '2026-10-10', staging_deploys: 4, production_deploys: 1, last_deployed_on: '2026-10-10' },
      { task_key: 'A-3', project_id: 'p1', first_staging_on: '2026-10-03', first_production_on: null, staging_deploys: 3, production_deploys: 0, last_deployed_on: '2026-10-08' },
      { task_key: 'A-4', project_id: 'p1', first_staging_on: '2026-01-03', first_production_on: null, staging_deploys: 1, production_deploys: 0, last_deployed_on: '2026-01-03' },
    ]
    const r = computeInsights(deploys, tasks, '2026-09-24', '2026-10-23')
    expect(r.production).toBe(2)
    expect(r.staging).toBe(1)
    expect(r.hotfixRate).toBe(0.5)
    expect(r.leadTimeMedian).toBe(12)
    expect(r.waiting.map((t) => t.task_key)).toEqual(['A-3'])
    expect(r.waiting[0].waitingDays).toBe(20)
    expect(r.rework.map((t) => t.task_key)).toEqual(['A-2', 'A-3'])
    expect(r.weeks[0].week).toBe('2026-09-21')
    expect(r.weeks.reduce((n, w) => n + w.staging + w.production, 0)).toBe(3)
    expect(r.lanes[0].deploys).toHaveLength(3)
  })

  it('conta PRs sem task e os que esperam produção', () => {
    const pr = (id: string, status: 'linked' | 'no_task' | 'pending', staging: string | null, prod: string | null) => ({
      id, project_id: 'p1', url: `u/${id}`, number: 1, description: null, link_status: status,
      first_staging_on: staging, first_production_on: prod, last_deployed_on: prod ?? staging,
    })
    const r = computeInsights([], [], '2026-10-01', '2026-10-23', [
      pr('a', 'linked', '2026-10-02', '2026-10-05'),
      pr('b', 'no_task', '2026-10-03', null),
      pr('c', 'pending', '2026-10-04', null),
      pr('d', 'no_task', '2026-08-01', '2026-08-02'),
    ])
    expect([r.prsInPeriod, r.prNoTask, r.prPending]).toEqual([3, 1, 1])
    expect(r.waitingNoTaskPrs.map((p) => [p.id, p.waitingDays])).toEqual([['b', 20]])
  })
})
