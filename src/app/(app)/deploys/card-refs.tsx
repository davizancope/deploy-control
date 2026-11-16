import Link from 'next/link'
import type { DeployListItem } from '@/lib/data'
import { groupPrsByTask, TASK_ROWS_VISIBLE, type RefPr } from '@/lib/deploy-refs'
import { plural, prLabel } from '@/lib/format'

const CHIP = 'code inline-block truncate rounded-xl border border-line bg-lift px-2 py-0.5 align-middle text-sm hover:border-ink'
const ROW = 'grid grid-cols-[9rem_1rem_minmax(0,1fr)] items-center gap-x-2.5 py-1.5 sm:grid-cols-[10rem_1rem_minmax(0,1fr)]'

/**
 * Linha do card: o rótulo (task ou grupo) à esquerda e os PRs ligados a ele à direita.
 * @param props.label Conteúdo da primeira coluna.
 * @param props.prs PRs da linha; vazio mostra "sem PR". PR com descrição ganha a linha toda, com o texto limitado a duas linhas.
 * @returns Item de lista em três colunas (rótulo, seta, PRs).
 */
function RefRow({ label, prs }: { label: React.ReactNode; prs: RefPr[] }) {
  return (
    <li className={ROW}>
      <span className="pointer-events-auto min-w-0 justify-self-start">{label}</span>
      <span aria-hidden="true" className="text-center text-muted">→</span>
      <div className="flex min-w-0 flex-wrap gap-x-1.5 gap-y-1">
        {prs.length === 0 ? (
          <span className="text-sm text-muted">sem PR</span>
        ) : (
          prs.map((pr) => (
            <div key={pr.id} className={`flex min-w-0 items-start gap-2 ${pr.description ? 'basis-full' : ''}`}>
              <a href={pr.url} target="_blank" rel="noopener noreferrer" className={`${CHIP} pointer-events-auto max-w-40 shrink-0 border-dashed`}>
                {prLabel(pr.number, pr.url)}
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
              {pr.description && <span className="line-clamp-2 min-w-0 break-words py-0.5 text-sm text-ink-2" title={pr.description}>{pr.description}</span>}
            </div>
          ))
        )}
      </div>
    </li>
  )
}

/**
 * Linha de uma task, com o chip que leva à página da task.
 * @param props.task Chave da task.
 * @param props.prs PRs ligados a ela.
 * @returns Linha task → PRs.
 */
function TaskRow({ task, prs }: { task: string; prs: RefPr[] }) {
  return <RefRow label={<Link href={`/tasks/${task}`} className={`${CHIP} max-w-full`} title={task}>{task}</Link>} prs={prs} />
}

/**
 * Bloco de detalhes do card de deploy: task → PRs (com a descrição de cada PR), PRs sem task e PRs a vincular.
 * Para não estourar o card: só as primeiras tasks aparecem (o resto fica em "ver mais"), chips longos são cortados e a descrição do PR fica limitada a duas linhas.
 * @param props.deploy Deploy da listagem, com tasks e PRs.
 * @returns O bloco, ou nada quando o deploy não tem tasks nem PRs.
 */
export function CardRefs({ deploy }: { deploy: Pick<DeployListItem, 'tasks' | 'pull_requests'> }) {
  const { byTask, noTask, pending } = groupPrsByTask(deploy.tasks, deploy.pull_requests)
  if (byTask.length + noTask.length + pending.length === 0) return null
  const visible = byTask.slice(0, TASK_ROWS_VISIBLE)
  const rest = byTask.slice(TASK_ROWS_VISIBLE)
  const hasExtra = noTask.length + pending.length > 0

  return (
    <div className="pointer-events-none relative pb-3 pl-12 pr-4 group-data-[refs=hide]/refs:hidden">
      {byTask.length > 0 && (
        <ul aria-label="Tasks e PRs" className="divide-y divide-line">
          {visible.map((r) => <TaskRow key={r.task} task={r.task} prs={r.prs} />)}
        </ul>
      )}
      {rest.length > 0 && (
        <details className="group/more border-t border-line">
          <summary className="pointer-events-auto inline-block list-none py-1.5 text-sm text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
            <span className="group-open/more:hidden">Ver mais {plural(rest.length, 'task', 'tasks')}</span>
            <span className="hidden group-open/more:inline">Ver menos</span>
          </summary>
          <ul className="divide-y divide-line border-t border-line">
            {rest.map((r) => <TaskRow key={r.task} task={r.task} prs={r.prs} />)}
          </ul>
        </details>
      )}
      {hasExtra && (
        <ul aria-label="PRs sem task" className={`divide-y divide-line ${byTask.length > 0 ? 'border-t border-line' : ''}`}>
          {noTask.length > 0 && <RefRow label={<span className="text-sm text-ink-2">Sem task</span>} prs={noTask} />}
          {pending.length > 0 && <RefRow label={<span className="text-sm text-warn">A vincular</span>} prs={pending} />}
        </ul>
      )}
    </div>
  )
}
