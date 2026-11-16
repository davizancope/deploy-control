/** Quantas tasks aparecem de cara em cada card; o resto fica atrás de "ver mais". */
export const TASK_ROWS_VISIBLE = 6

/** PR de um deploy com as tasks a que está ligado. */
export type RefPr = { id: string; url: string; number: number | null; description: string | null; no_task: boolean; tasks: string[] }

export type TaskRefRow = { task: string; prs: RefPr[] }

export type RefGroups = {
  /** Uma linha por task do deploy, com os PRs ligados a ela (um PR pode estar em várias linhas). */
  byTask: TaskRefRow[]
  /** PRs marcados como "sem task". */
  noTask: RefPr[]
  /** PRs que não ligam a nenhuma task deste deploy e não foram marcados como "sem task". */
  pending: RefPr[]
}

/**
 * Cruza as tasks de um deploy com os PRs, para mostrar qual PR entregou qual task.
 * @param tasks Tasks do deploy, na ordem de exibição.
 * @param prs PRs do deploy, cada um com suas tasks.
 * @returns Linhas por task mais os PRs sem task e os a vincular.
 */
export function groupPrsByTask(tasks: string[], prs: RefPr[]): RefGroups {
  const byTask = tasks.map((task) => ({ task, prs: prs.filter((p) => p.tasks.includes(task)) }))
  const matched = new Set(byTask.flatMap((r) => r.prs.map((p) => p.id)))
  const rest = prs.filter((p) => !matched.has(p.id))
  return { byTask, noTask: rest.filter((p) => p.no_task), pending: rest.filter((p) => !p.no_task) }
}
