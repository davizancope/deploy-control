'use client'

import { FieldError, FormNotice, SubmitButton } from '@/components/ui'
import { useFormAction } from '@/components/use-form-action'
import { saveProject } from './actions'

type Values = { id: string; name: string; jira_base_url: string | null; jira_project_prefix: string | null; repo_url: string | null }

export function ProjectForm({ values, submitLabel }: { values?: Values; submitLabel: string }) {
  const { state, onSubmit, pending } = useFormAction(saveProject)
  const err = state.fieldErrors ?? {}
  const prefix = values?.id ? `p-${values.id}-` : 'new-'
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormNotice error={state.error} message={state.message} />
      <input type="hidden" name="id" value={values?.id ?? ''} />
      <div>
        <label className="label" htmlFor={`${prefix}name`}>Nome do projeto</label>
        <input className="field" id={`${prefix}name`} name="name" defaultValue={values?.name} placeholder="Ex.: Suzano" required />
        <FieldError message={err.name} />
      </div>
      <div>
        <label className="label" htmlFor={`${prefix}jira`}>Endereço do Jira</label>
        <input className="field code" id={`${prefix}jira`} name="jira_base_url" defaultValue={values?.jira_base_url ?? ''} placeholder="https://empresa.atlassian.net" spellCheck={false} />
        <FieldError message={err.jira_base_url} />
      </div>
      <div>
        <label className="label" htmlFor={`${prefix}jira-prefix`}>Prefixo das tasks no Jira</label>
        <input className="field code" id={`${prefix}jira-prefix`} name="jira_project_prefix" defaultValue={values?.jira_project_prefix ?? ''} placeholder="SUZSFCCSUS" maxLength={20} spellCheck={false} autoCapitalize="characters" aria-describedby={`${prefix}jira-prefix-hint`} />
        <p id={`${prefix}jira-prefix-hint`} className="mt-1.5 text-sm text-muted">Com ele, dá para informar a task só pelo número (1184 vira SUZSFCCSUS-1184).</p>
        <FieldError message={err.jira_project_prefix} />
      </div>
      <div>
        <label className="label" htmlFor={`${prefix}repo`}>Repositório</label>
        <input className="field code" id={`${prefix}repo`} name="repo_url" defaultValue={values?.repo_url ?? ''} placeholder="https://bitbucket.org/empresa/repositorio" spellCheck={false} aria-describedby={`${prefix}repo-hint`} />
        <p id={`${prefix}repo-hint`} className="mt-1.5 text-sm text-muted">Com ele, dá para informar o PR só pelo número.</p>
        <FieldError message={err.repo_url} />
      </div>
      <SubmitButton busy={pending}>{submitLabel}</SubmitButton>
    </form>
  )
}
