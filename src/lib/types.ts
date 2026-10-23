export type Environment = 'staging' | 'production'
export type DeployType = 'release' | 'hotfix' | 'bugfix'
export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer'

export type PrLink = { url: string; number: number | null }
export type CommitLink = { sha: string; cherry_pick: boolean }

/** Ligação com tasks: tasks vazias + no_task false = ainda a vincular. */
export type TaskLink = { tasks: string[]; no_task: boolean; description: string | null }
export type LinkedPr = PrLink & TaskLink
export type LinkedCommit = CommitLink & TaskLink

/** Deploy já normalizado, no formato que as RPCs save_deployment/import_deployments esperam. */
export type DeployInput = {
  project_id: string
  code_version: string
  branch: string | null
  environment: Environment
  deployed_on: string
  sprint: string | null
  type: DeployType
  source_branch: string | null
  merged_branches: string[]
  notes: string | null
  tasks: string[]
  pull_requests: LinkedPr[]
  commits: LinkedCommit[]
  /** replace: o vínculo informado substitui o anterior (formulário); merge: só acrescenta (importação). */
  link_mode: 'replace' | 'merge'
}

export const ENVIRONMENT_LABEL: Record<Environment, string> = {
  staging: 'Staging',
  production: 'Produção',
}

export const TYPE_LABEL: Record<DeployType, string> = {
  release: 'Release',
  hotfix: 'Hotfix',
  bugfix: 'Bugfix',
}

export const ROLE_LABEL: Record<OrgRole, string> = {
  owner: 'Dono',
  admin: 'Admin',
  member: 'Membro',
  viewer: 'Leitura',
}
