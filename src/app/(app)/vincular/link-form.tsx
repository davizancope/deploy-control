'use client'

import { useState } from 'react'
import { FormNotice, SubmitButton } from '@/components/ui'
import { useFormAction } from '@/components/use-form-action'
import { linkRef } from './actions'

/**
 * Formulário para ligar um PR ou commit às tasks (ou marcar como sem task).
 * @param props.kind Tipo do item.
 * @param props.id ID do PR ou commit.
 * @param props.candidates Tasks dos deploys em que o item subiu.
 * @returns Formulário compacto.
 */
export function LinkForm({ kind, id, candidates }: { kind: 'pr' | 'commit'; id: string; candidates: string[] }) {
  const { state, onSubmit, pending } = useFormAction(linkRef)
  const [noTask, setNoTask] = useState(false)
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      {candidates.length > 0 && (
        <fieldset disabled={noTask}>
          <legend className="mb-1.5 text-sm text-ink-2">Tasks dos deploys em que subiu</legend>
          <div className="flex flex-wrap gap-2">
            {candidates.map((t) => (
              <label key={t} className="cursor-pointer">
                <input type="checkbox" name="tasks" value={t} className="peer sr-only" />
                <span className="code inline-block rounded-md border border-line-strong bg-surface px-2 py-1 text-sm peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--focus)] peer-disabled:opacity-50">
                  {t}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label className="label" htmlFor={`other-${id}`}>Outra task</label>
          <input id={`other-${id}`} name="other" className="field code" placeholder="ABC-123" disabled={noTask} spellCheck={false} />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" name="no_task" checked={noTask} onChange={(e) => setNoTask(e.target.checked)} className="size-4 accent-[var(--ink)]" />
          Sem task
        </label>
      </div>
      {noTask && (
        <div>
          <label className="label" htmlFor={`desc-${id}`}>O que mudou</label>
          <input id={`desc-${id}`} name="description" className="field" required maxLength={300} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton busy={pending} pending="Salvando…" className="btn-quiet py-1.5 text-sm">Salvar vínculo</SubmitButton>
        <div className="min-w-0 flex-1"><FormNotice error={state.error} message={state.message} /></div>
      </div>
    </form>
  )
}
