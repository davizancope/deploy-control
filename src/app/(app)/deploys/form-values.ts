import type { DeployDetail } from '@/lib/data'
import { todayIso } from '@/lib/parse/dates'
import { emptyRow, type ChangeRow } from '@/lib/change-rows'
import type { DeployFormValues } from './deploy-form'

/**
 * Valores do formulário a partir de um deploy existente (para editar ou promover).
 * @param d Deploy salvo.
 * @returns Valores prontos para os campos.
 */
export function valuesFromDeploy(d: DeployDetail): DeployFormValues {
  return {
    id: d.id,
    project_id: d.project_id,
    code_version: d.code_version,
    branch: d.branch ?? '',
    environment: d.environment,
    deployed_on: d.deployed_on,
    sprint: d.sprint ?? '',
    type: d.type,
    source_branch: d.source_branch ?? '',
    merged_branches: d.merged_branches.join('\n'),
    changes: rowsFromDeploy(d),
    notes: d.notes ?? '',
  }
}

/**
 * Formulário em branco.
 * @param projectId Projeto pré-selecionado.
 * @returns Valores iniciais.
 */
export function emptyValues(projectId = ''): DeployFormValues {
  return {
    id: '',
    project_id: projectId,
    code_version: '',
    branch: '',
    environment: 'staging',
    deployed_on: todayIso(),
    sprint: '',
    type: 'release',
    source_branch: '',
    merged_branches: '',
    changes: [emptyRow()],
    notes: '',
  }
}

/**
 * Linhas do formulário a partir dos PRs, commits e tasks de um deploy.
 * @param d Deploy salvo.
 * @returns Uma linha por PR/commit e uma por task que não veio de nenhum deles.
 */
export function rowsFromDeploy(d: DeployDetail): ChangeRow[] {
  const covered = new Set<string>()
  const rows: ChangeRow[] = []
  for (const p of d.pull_requests) {
    p.tasks.forEach((t) => covered.add(t))
    rows.push({ ref: p.url, tasks: p.tasks.join(' '), description: p.description ?? '' })
  }
  for (const c of d.commits) {
    c.tasks.forEach((t) => covered.add(t))
    rows.push({ ref: c.cherry_pick ? `cherry pick ${c.sha}` : c.sha, tasks: c.tasks.join(' '), description: c.description ?? '' })
  }
  const branchKeys = new Set(d.merged_branches.flatMap((b) => b.match(/[A-Z][A-Z0-9]{1,19}-\d{1,7}/g) ?? []))
  for (const t of d.tasks) if (!covered.has(t) && !branchKeys.has(t)) rows.push({ ref: '', tasks: t, description: '' })
  return rows.length ? rows : [emptyRow()]
}
