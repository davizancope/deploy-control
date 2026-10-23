import type { LinkedCommit, LinkedPr } from '@/lib/types'
import { extractTokens, TASK_KEY_RE } from './tokens'

export type PairResult = {
  pullRequests: LinkedPr[]
  commits: LinkedCommit[]
  tasks: string[]
  notes: string[]
  jiraBaseUrls: string[]
  repoUrls: string[]
}

type TaskItem = { keys: string[]; noTask: boolean; label: string | null; note: string | null }
type RefItem = { prs: LinkedPr[]; commits: LinkedCommit[]; notes: string[] }

const lines = (text: string | null | undefined) =>
  (text ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

/**
 * Pareia, linha a linha, a coluna de tasks com a coluna de PRs/commits (como a planilha é montada).
 * Com o mesmo número de linhas, a linha N de uma é a linha N da outra; com uma task só, todos os PRs são dela;
 * com um PR só, ele leva todas as tasks; fora isso, os PRs ficam a vincular.
 * @param taskText Conteúdo da coluna de tasks (links, chaves, "NO TASK [X]" ou descrição livre).
 * @param refText Conteúdo da coluna de PRs (links, números, commits, cherry-picks).
 * @returns PRs e commits já ligados às tasks, tasks do deploy e observações que sobraram.
 */
export function pairColumns(taskText: string | null | undefined, refText: string | null | undefined): PairResult {
  const jiraBaseUrls: string[] = []
  const repoUrls: string[] = []
  const notes: string[] = []

  const taskItems: TaskItem[] = lines(taskText).map((line) => {
    const t = extractTokens(line)
    jiraBaseUrls.push(...t.jiraBaseUrls)
    if (t.tasks.length) return { keys: t.tasks, noTask: false, label: null, note: null }
    const inText = [...line.matchAll(TASK_KEY_RE)].map((m) => m[1])
    if (inText.length && !/^no\s*-?\s*task/i.test(line)) return { keys: [...new Set(inText)], noTask: false, label: null, note: null }
    const noTask = t.notes.find((n) => n.startsWith('Sem task'))
    if (noTask !== undefined) return { keys: [], noTask: true, label: cleanLabel(noTask.replace(/^Sem task\s*/, '')), note: null }
    if (/^https?:\/\//i.test(line)) return { keys: [], noTask: false, label: null, note: line }
    return { keys: [], noTask: true, label: cleanLabel(line), note: null }
  })

  const refItems: RefItem[] = lines(refText).map((line) => {
    const t = extractTokens(line)
    repoUrls.push(...t.repoUrls)
    return {
      prs: t.pullRequests.map((p) => ({ ...p, tasks: [], no_task: false, description: null })),
      commits: t.commits.map((c) => ({ ...c, tasks: [], no_task: false, description: null })),
      notes: [...t.notes, ...t.tasks],
    }
  })

  const refCount = refItems.reduce((n, r) => n + r.prs.length + r.commits.length, 0)
  const allKeys = [...new Set(taskItems.flatMap((t) => t.keys))]
  const paired = new Set<number>()

  if (refCount > 0 && taskItems.length === refItems.length) {
    refItems.forEach((ref, i) => {
      if (ref.prs.length || ref.commits.length) {
        assign(ref, taskItems[i])
        paired.add(i)
      }
    })
  } else if (refCount > 0 && taskItems.length === 1) {
    refItems.forEach((ref) => assign(ref, taskItems[0]))
    paired.add(0)
  } else if (refCount === 1 && taskItems.length > 0) {
    const labels = taskItems.filter((t) => t.noTask && t.label).map((t) => t.label!)
    refItems.forEach((ref) =>
      assign(ref, { keys: allKeys, noTask: allKeys.length === 0, label: labels.length ? labels.join(', ') : null, note: null }),
    )
    taskItems.forEach((_, i) => paired.add(i))
  }

  taskItems.forEach((t, i) => {
    if (t.note) notes.push(t.note)
    else if (t.noTask && !paired.has(i)) notes.push(t.label ? `Sem task: ${t.label}` : 'Sem task')
  })
  refItems.forEach((r) => notes.push(...r.notes))

  return {
    pullRequests: mergeLinks(refItems.flatMap((r) => r.prs), (p) => p.url),
    commits: mergeLinks(refItems.flatMap((r) => r.commits), (c) => c.sha),
    tasks: allKeys,
    notes: [...new Set(notes)],
    jiraBaseUrls: [...new Set(jiraBaseUrls)],
    repoUrls: [...new Set(repoUrls)],
  }
}

function assign(ref: RefItem, item: TaskItem) {
  for (const target of [...ref.prs, ...ref.commits]) {
    target.tasks = [...item.keys]
    target.no_task = item.keys.length === 0 && item.noTask
    target.description = item.keys.length ? null : item.label
  }
}

function cleanLabel(label: string): string | null {
  const v = label.trim().replace(/^[[(]\s*/, '').replace(/\s*[\])]$/, '').trim()
  return v ? v.slice(0, 300) : null
}

/**
 * Junta itens repetidos (mesmo PR ou commit duas vezes), unindo as tasks.
 * @param items Itens possivelmente repetidos.
 * @param key Identidade do item.
 * @returns Itens únicos.
 */
export function mergeLinks<T extends { tasks: string[]; no_task: boolean; description: string | null }>(items: T[], key: (t: T) => string): T[] {
  const map = new Map<string, T>()
  for (const item of items) {
    const prev = map.get(key(item))
    if (!prev) {
      map.set(key(item), { ...item, tasks: [...item.tasks] })
      continue
    }
    prev.tasks = [...new Set([...prev.tasks, ...item.tasks])]
    prev.no_task = prev.tasks.length === 0 && (prev.no_task || item.no_task)
    prev.description = prev.description ?? item.description
  }
  return [...map.values()]
}
