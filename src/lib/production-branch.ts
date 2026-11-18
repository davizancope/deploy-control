import type { BranchMerge } from '@/lib/branch-graph'

export type ProductionDeploy = { id: string; code_version: string; branch: string | null; deployed_on: string }

export type CurrentProduction = {
  deployId: string
  codeVersion: string
  /** Branch do deploy; null quando o deploy foi registrado sem branch. */
  branch: string | null
  deployedOn: string
  /** Primeiro merge da branch no tronco; null enquanto não foi registrado. */
  merge: BranchMerge | null
}

const TRUNK_NAMES = ['master', 'main']

/**
 * Descobre o que está em produção agora e se já voltou para o tronco.
 * @param deploy Deploy de produção mais recente do projeto, sem filtro de período; null quando nunca houve.
 * @param merges Merges registrados no projeto.
 * @param trunk Nome do tronco; master e main contam como o mesmo.
 * @returns A produção atual com o merge da branch no tronco, ou null sem deploy de produção.
 */
export function currentProduction(deploy: ProductionDeploy | null, merges: BranchMerge[], trunk: string): CurrentProduction | null {
  if (!deploy) return null
  const branch = deploy.branch?.trim() || null
  const toTrunk = (target: string) => target === trunk || (TRUNK_NAMES.includes(target) && TRUNK_NAMES.includes(trunk))
  const merge = branch
    ? ([...merges]
        .filter((m) => m.branch.trim() === branch && toTrunk(m.target_branch))
        .sort((a, b) => a.merged_on.localeCompare(b.merged_on) || a.id.localeCompare(b.id))[0] ?? null)
    : null
  return { deployId: deploy.id, codeVersion: deploy.code_version, branch, deployedOn: deploy.deployed_on, merge }
}
