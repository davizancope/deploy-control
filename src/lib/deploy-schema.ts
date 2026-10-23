import { z } from 'zod'

const taskKey = z.string().regex(/^[A-Z][A-Z0-9]{1,19}-\d{1,7}$/)
const link = {
  tasks: z.array(taskKey).max(50),
  no_task: z.boolean(),
  description: z.string().max(300).nullable(),
}

/** Validação de um deploy normalizado vindo do navegador (importação). Espelha as constraints do banco. */
export const deployRowSchema = z.object({
  code_version: z.string().trim().min(1).max(120).regex(/^\S+$/),
  branch: z.string().max(200).nullable(),
  environment: z.enum(['staging', 'production']),
  deployed_on: z.iso.date(),
  sprint: z.string().max(60).nullable(),
  type: z.enum(['release', 'hotfix', 'bugfix']),
  source_branch: z.string().max(200).nullable(),
  merged_branches: z.array(z.string().min(1).max(200)).max(50),
  notes: z.string().max(2000).nullable(),
  tasks: z.array(taskKey).max(200),
  pull_requests: z
    .array(z.object({ url: z.string().max(500).regex(/^https?:\/\/\S+$/), number: z.number().int().positive().nullable(), ...link }))
    .max(200),
  commits: z.array(z.object({ sha: z.string().regex(/^[0-9a-f]{7,40}$/), cherry_pick: z.boolean(), ...link })).max(100),
})

export type DeployRow = z.infer<typeof deployRowSchema>

export const importPayloadSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  sheets: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        target: z.union([z.literal('new'), z.uuid()]),
        jiraBaseUrl: z.string().regex(/^https:\/\/\S+$/).max(200).nullable(),
        repoUrl: z.string().regex(/^https:\/\/\S+$/).max(300).nullable(),
        deploys: z.array(deployRowSchema).max(5000),
      }),
    )
    .min(1)
    .max(30),
})

export type ImportPayload = z.infer<typeof importPayloadSchema>
