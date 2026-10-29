'use client'

import { FieldError, FormNotice, SubmitButton } from '@/components/ui'
import { useFormAction } from '@/components/use-form-action'
import { saveBranchMerge } from './actions'

/**
 * Formulário para registrar que a branch chegou na master (ou em outro destino).
 * @param props.projectId Projeto da branch.
 * @param props.branch Branch que foi mesclada.
 * @param props.today Data de hoje em ISO, sugerida como data do merge.
 * @returns Formulário compacto do painel da branch.
 */
export function MergeForm({ projectId, branch, today }: { projectId: string; branch: string; today: string }) {
  const { state, onSubmit, pending } = useFormAction(saveBranchMerge)
  const err = state.fieldErrors ?? {}
  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <FormNotice error={state.error} message={state.message} />
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="branch" value={branch} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="merge-target">Destino</label>
          <input className="field code" id="merge-target" name="target_branch" defaultValue="master" spellCheck={false} />
          <FieldError message={err.target_branch} />
        </div>
        <div>
          <label className="label" htmlFor="merge-date">Data</label>
          <input className="field" id="merge-date" name="merged_on" type="date" defaultValue={today} />
          <FieldError message={err.merged_on} />
        </div>
      </div>
      <SubmitButton busy={pending} pending="Registrando…" className="btn-quiet w-full">Registrar merge</SubmitButton>
    </form>
  )
}
