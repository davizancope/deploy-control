'use client'

import Link from 'next/link'
import { useState } from 'react'
import { EnvMark, FieldError, FormNotice, SubmitButton, TypeMark } from '@/components/ui'
import { useFormAction } from '@/components/use-form-action'
import type { ChangeRow } from '@/lib/change-rows'
import { TYPE_LABEL } from '@/lib/types'
import { saveDeploy } from './actions'
import type { KnownLink } from '@/lib/data'
import { ChangesEditor } from './changes-editor'

const TYPE_CHECKED = {
  release: 'peer-checked:border-release peer-checked:bg-release-soft',
  hotfix: 'peer-checked:border-hotfix peer-checked:bg-hotfix-soft',
  bugfix: 'peer-checked:border-bugfix peer-checked:bg-bugfix-soft',
} as const

export type DeployFormValues = {
  id: string
  project_id: string
  code_version: string
  branch: string
  environment: 'staging' | 'production'
  deployed_on: string
  sprint: string
  type: 'release' | 'hotfix' | 'bugfix'
  source_branch: string
  merged_branches: string
  changes: ChangeRow[]
  notes: string
}

type ProjectOption = { id: string; name: string; repo_url: string | null; jira_project_prefix: string | null }

export function DeployForm({
  values,
  projects,
  latest,
  known,
  cancelHref,
}: {
  values: DeployFormValues
  projects: ProjectOption[]
  latest: Record<string, { code_version: string; deployed_on: string }>
  known: Record<string, KnownLink[]>
  cancelHref: string
}) {
  const { state, onSubmit, pending } = useFormAction(saveDeploy)
  const [projectId, setProjectId] = useState(values.project_id)
  const [env, setEnv] = useState(values.environment)
  const err = state.fieldErrors ?? {}
  const last = latest[projectId]
  const project = projects.find((p) => p.id === projectId)
  const repo = project?.repo_url

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      <input type="hidden" name="id" value={values.id} />
      <FormNotice error={state.error ?? (Object.keys(err).length ? 'Confira os campos marcados.' : undefined)} />

      <fieldset className="space-y-5">
        <legend className="mb-4 text-lg font-semibold">O que subiu</legend>

        <div role="radiogroup" aria-label="Ambiente" className="grid grid-cols-2 gap-3 sm:max-w-md">
          {(['staging', 'production'] as const).map((e) => {
            const checked = env === e
            const prod = e === 'production'
            return (
              <label
                key={e}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3 transition-colors has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-[var(--focus)] ${
                  checked
                    ? prod ? 'border-production bg-production-soft' : 'border-staging bg-staging-soft'
                    : 'border-line bg-sunken hover:border-line-strong'
                }`}
              >
                <input type="radio" name="environment" value={e} checked={checked} onChange={() => setEnv(e)} className="sr-only" />
                <span className={prod ? 'text-production' : 'text-staging'}><EnvMark env={e} size={22} /></span>
                <span className="font-semibold">{prod ? 'Produção' : 'Staging'}</span>
              </label>
            )
          })}
        </div>
        <FieldError message={err.environment} />

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="project_id">Projeto</label>
            <select className="field" id="project_id" name="project_id" value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
              <option value="" disabled>Escolha…</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <FieldError message={err.project_id} />
          </div>
          <div>
            <label className="label" htmlFor="deployed_on">Data do deploy</label>
            <input className="field" id="deployed_on" name="deployed_on" type="date" defaultValue={values.deployed_on} required />
            <FieldError message={err.deployed_on} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="code_version">Code version</label>
          <input className="field code" id="code_version" name="code_version" defaultValue={values.code_version} required spellCheck={false} autoComplete="off" aria-describedby="cv-hint" />
          <p id="cv-hint" className="mt-1.5 text-sm text-muted">
            {last ? <>Último neste projeto: <span className="code text-ink-2">{last.code_version}</span></> : 'Exatamente como aparece no Business Manager.'}
          </p>
          <FieldError message={err.code_version} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="branch">Branch base</label>
            <input className="field code" id="branch" name="branch" defaultValue={values.branch} placeholder="release/4.2.0" spellCheck={false} />
            <FieldError message={err.branch} />
          </div>
          <div>
            <label className="label" htmlFor="source_branch">Criada a partir da</label>
            <input className="field code" id="source_branch" name="source_branch" defaultValue={values.source_branch} placeholder="release/4.1.0" spellCheck={false} />
            <FieldError message={err.source_branch} />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-[1fr_1fr]">
          <fieldset>
            <legend className="label">Tipo</legend>
            <div className="flex gap-2">
              {(['release', 'hotfix', 'bugfix'] as const).map((t) => (
                <label key={t} className="flex-1">
                  <input type="radio" name="type" value={t} defaultChecked={values.type === t} className="peer sr-only" />
                  <span className={`block cursor-pointer rounded-xl border border-line-strong bg-lift px-3 py-2 text-center text-[15px] ${TYPE_CHECKED[t]} peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus)]`}>
                    <span className="inline-flex items-center justify-center gap-2">
                      <TypeMark type={t} size={16} />
                      {TYPE_LABEL[t]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <FieldError message={err.type} />
          </fieldset>
          <div>
            <label className="label" htmlFor="sprint">Sprint</label>
            <input className="field" id="sprint" name="sprint" defaultValue={values.sprint} placeholder="64" />
            <FieldError message={err.sprint} />
          </div>
        </div>
      </fieldset>

      <hr className="border-line" />
      <fieldset className="space-y-5">
        <legend className="mb-4 text-lg font-semibold">O que foi junto</legend>
        <ChangesEditor initial={values.changes} repoUrl={repo ?? null} jiraPrefix={project?.jira_project_prefix ?? null} known={known[projectId] ?? []} error={err.changes} />
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <label className="label" htmlFor="merged_branches">Branches incluídas</label>
            <textarea className="field code min-h-24" id="merged_branches" name="merged_branches" defaultValue={values.merged_branches} spellCheck={false} aria-describedby="br-hint" />
            <p id="br-hint" className="mt-1.5 text-sm text-muted">Uma por linha. Tasks no nome da branch entram no deploy.</p>
            <FieldError message={err.merged_branches} />
          </div>
          <div>
            <label className="label" htmlFor="notes">Observações</label>
            <textarea className="field min-h-24" id="notes" name="notes" defaultValue={values.notes} />
            <FieldError message={err.notes} />
          </div>
        </div>
      </fieldset>

      <div className="flex items-center gap-3 border-t border-line pt-6">
        <SubmitButton busy={pending} pending="Salvando…">{values.id ? 'Salvar alterações' : 'Registrar deploy'}</SubmitButton>
        <Link href={cancelHref} className="btn px-3 text-ink-2 hover:text-ink">Cancelar</Link>
      </div>
    </form>
  )
}
