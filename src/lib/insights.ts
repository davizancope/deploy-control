import { addDays, daysBetween, median, weekStart } from '@/lib/format'
import type { DeployType, Environment } from '@/lib/types'

export type DashDeploy = {
  id: string
  project_id: string
  project_name: string
  code_version: string
  environment: Environment
  type: DeployType
  deployed_on: string
}

export type DashTask = {
  task_key: string
  project_id: string
  first_staging_on: string | null
  first_production_on: string | null
  staging_deploys: number
  production_deploys: number
  last_deployed_on: string
}

export type DashPr = {
  id: string
  project_id: string
  url: string
  number: number | null
  description: string | null
  link_status: 'linked' | 'no_task' | 'pending'
  first_staging_on: string | null
  first_production_on: string | null
  last_deployed_on: string | null
}

export type WeekBucket = { week: string; staging: number; production: number; hotfix: number }

export type Insights = {
  from: string
  to: string
  production: number
  staging: number
  hotfixes: number
  hotfixRate: number | null
  leadTimeMedian: number | null
  leadTimeSample: number
  waiting: Array<DashTask & { waitingDays: number }>
  rework: DashTask[]
  weeks: WeekBucket[]
  lanes: Array<{ project_id: string; project_name: string; deploys: DashDeploy[] }>
  latestProduction: DashDeploy[]
  prsInPeriod: number
  prNoTask: number
  prPending: number
  waitingNoTaskPrs: Array<DashPr & { waitingDays: number }>
}

/**
 * Calcula os indicadores do painel a partir dos deploys do período e do resumo por task.
 * @param deploys Deploys dentro do período.
 * @param tasks Resumo por task (todas as datas; o período é aplicado aqui).
 * @param from Início do período (ISO).
 * @param to Fim do período (ISO).
 * @param prs Resumo por PR (para os PRs sem task).
 * @returns Números, listas e séries prontos para exibir.
 */
export function computeInsights(deploys: DashDeploy[], tasks: DashTask[], from: string, to: string, prs: DashPr[] = []): Insights {
  const prod = deploys.filter((d) => d.environment === 'production')
  const hotfixes = prod.filter((d) => d.type === 'hotfix').length

  const leadTimes = tasks
    .filter((t) => t.first_staging_on && t.first_production_on && t.first_production_on >= from && t.first_production_on <= to)
    .map((t) => Math.max(0, daysBetween(t.first_staging_on!, t.first_production_on!)))

  const waiting = tasks
    .filter((t) => !t.first_production_on && t.first_staging_on && t.last_deployed_on >= from)
    .map((t) => ({ ...t, waitingDays: daysBetween(t.first_staging_on!, to) }))
    .sort((a, b) => b.waitingDays - a.waitingDays)

  const rework = tasks
    .filter((t) => t.staging_deploys >= 3 && t.last_deployed_on >= from)
    .sort((a, b) => b.staging_deploys - a.staging_deploys || b.last_deployed_on.localeCompare(a.last_deployed_on))

  const weeks: WeekBucket[] = []
  for (let w = weekStart(from); w <= to; w = addDays(w, 7)) weeks.push({ week: w, staging: 0, production: 0, hotfix: 0 })
  const byWeek = new Map(weeks.map((w) => [w.week, w]))
  for (const d of deploys) {
    const bucket = byWeek.get(weekStart(d.deployed_on))
    if (!bucket) continue
    bucket[d.environment]++
    if (d.type === 'hotfix' && d.environment === 'production') bucket.hotfix++
  }

  const laneMap = new Map<string, { project_id: string; project_name: string; deploys: DashDeploy[] }>()
  for (const d of deploys) {
    const lane = laneMap.get(d.project_id) ?? { project_id: d.project_id, project_name: d.project_name, deploys: [] }
    lane.deploys.push(d)
    laneMap.set(d.project_id, lane)
  }
  const lanes = [...laneMap.values()].sort((a, b) => b.deploys.length - a.deploys.length)

  const firstDeploy = (p: DashPr) => [p.first_staging_on, p.first_production_on].filter(Boolean).sort()[0] ?? null
  const prsInPeriod = prs.filter((p) => {
    const f = firstDeploy(p)
    return f !== null && f >= from && f <= to
  })
  const waitingNoTaskPrs = prs
    .filter((p) => p.link_status === 'no_task' && !p.first_production_on && p.first_staging_on && (p.last_deployed_on ?? '') >= from)
    .map((p) => ({ ...p, waitingDays: daysBetween(p.first_staging_on!, to) }))
    .sort((a, b) => b.waitingDays - a.waitingDays)

  return {
    from,
    to,
    prsInPeriod: prsInPeriod.length,
    prNoTask: prsInPeriod.filter((p) => p.link_status === 'no_task').length,
    prPending: prsInPeriod.filter((p) => p.link_status === 'pending').length,
    waitingNoTaskPrs,
    production: prod.length,
    staging: deploys.length - prod.length,
    hotfixes,
    hotfixRate: prod.length ? hotfixes / prod.length : null,
    leadTimeMedian: median(leadTimes),
    leadTimeSample: leadTimes.length,
    waiting,
    rework,
    weeks,
    lanes,
    latestProduction: [...prod].sort((a, b) => b.deployed_on.localeCompare(a.deployed_on)).slice(0, 6),
  }
}
