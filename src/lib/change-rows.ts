import { mergeLinks, pairColumns } from '@/lib/parse/changes'
import { extractTokens } from '@/lib/parse/tokens'
import type { LinkedCommit, LinkedPr } from '@/lib/types'

/** Uma linha do formulário: o PR ou commit, as tasks dele e a descrição (obrigatória quando não há task). */
export type ChangeRow = { ref: string; tasks: string; description: string }

export type ParsedRows = { pullRequests: LinkedPr[]; commits: LinkedCommit[]; tasks: string[]; errors: string[] }

export const emptyRow = (): ChangeRow => ({ ref: '', tasks: '', description: '' })

/**
 * Valida e converte as linhas do formulário em PRs/commits ligados a tasks.
 * @param rows Linhas digitadas.
 * @param repoUrl Repositório do projeto, para aceitar o PR só pelo número.
 * @param jiraPrefix Prefixo do Jira do projeto, para aceitar a task só pelo número.
 * @returns PRs, commits, todas as tasks do deploy e erros por linha.
 */
export function parseChangeRows(rows: ChangeRow[], repoUrl: string | null, jiraPrefix: string | null = null): ParsedRows {
  const pullRequests: LinkedPr[] = []
  const commits: LinkedCommit[] = []
  const tasks: string[] = []
  const errors: string[] = []

  rows.forEach((row, i) => {
    const ref = row.ref.trim()
    const taskText = row.tasks.trim()
    const description = row.description.trim().slice(0, 300) || null
    if (!ref && !taskText && !description) return
    const n = i + 1

    const t = extractTokens(taskText.replace(/[,;\s]+/g, '\n'), { jiraPrefix })
    const badTasks = [...t.notes.filter((x) => !/^sem task/i.test(x)), ...t.pullRequests.map((p) => p.url), ...t.commits.map((c) => c.sha)]
    if (badTasks.length) {
      const hint = jiraPrefix ? `o número (${jiraPrefix}-123 vira 123), a chave` : 'a chave (ABC-123)'
      errors.push(`Linha ${n}: task "${badTasks[0]}" não reconhecida. Use ${hint} ou o link do Jira.`)
    }
    const keys = t.tasks
    tasks.push(...keys)

    if (!ref) {
      if (!keys.length) errors.push(`Linha ${n}: informe o PR, o commit ou a task.`)
      return
    }

    const r = extractTokens(ref, { repoUrl })
    if (r.notes.length || r.tasks.length || r.pullRequests.length + r.commits.length === 0 || r.pullRequests.length > 1) {
      errors.push(
        repoUrl
          ? `Linha ${n}: não reconheci "${ref}". Use o link do PR, o número dele ou o hash do commit.`
          : `Linha ${n}: não reconheci "${ref}". Use o link completo do PR ou o hash do commit (para aceitar só o número, cadastre o repositório no projeto).`,
      )
      return
    }
    if (!keys.length && !description) {
      errors.push(`Linha ${n}: escolha a task ou descreva a mudança sem task.`)
      return
    }

    const link = { tasks: keys, no_task: keys.length === 0, description }
    pullRequests.push(...r.pullRequests.map((p) => ({ ...p, ...link, tasks: [...keys] })))
    commits.push(...r.commits.map((c) => ({ ...c, ...link, tasks: [...keys] })))
  })

  return {
    pullRequests: mergeLinks(pullRequests, (p) => p.url),
    commits: mergeLinks(commits, (c) => c.sha),
    tasks: [...new Set(tasks)],
    errors,
  }
}

/**
 * Monta linhas do formulário a partir das duas colunas coladas da planilha (tasks e PRs alinhados por linha).
 * @param taskText Coluna de tasks.
 * @param refText Coluna de PRs/commits.
 * @returns Linhas prontas; PRs que não deu para parear vêm com task e descrição em branco.
 */
export function rowsFromColumns(taskText: string, refText: string): ChangeRow[] {
  const pair = pairColumns(taskText, refText)
  const covered = new Set<string>()
  const rows: ChangeRow[] = []
  for (const p of pair.pullRequests) {
    p.tasks.forEach((t) => covered.add(t))
    rows.push({ ref: p.url, tasks: p.tasks.join(' '), description: p.description ?? '' })
  }
  for (const c of pair.commits) {
    c.tasks.forEach((t) => covered.add(t))
    rows.push({ ref: c.cherry_pick ? `cherry pick ${c.sha}` : c.sha, tasks: c.tasks.join(' '), description: c.description ?? '' })
  }
  for (const t of pair.tasks) if (!covered.has(t)) rows.push({ ref: '', tasks: t, description: '' })
  return rows
}
