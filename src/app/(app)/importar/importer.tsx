'use client'

import { startTransition, useActionState, useMemo, useState, type FormEvent } from 'react'
import { FormNotice, SubmitButton } from '@/components/ui'
import { formatDate, plural } from '@/lib/format'
import { commitImport, previewImport, type PreviewSheet, type PreviewState } from './actions'

type ProjectOption = { id: string; name: string }

function stripMeta(d: PreviewSheet['deploys'][number]) {
  const { sourceRow, warnings, ...row } = d
  void sourceRow
  void warnings
  return row
}

export function Importer({ projects, canManage }: { projects: ProjectOption[]; canManage: boolean }) {
  const [preview, dispatchPreview, previewing] = useActionState(previewImport, {} as PreviewState)
  const [commit, dispatchCommit, committing] = useActionState(commitImport, {})
  const [targets, setTargets] = useState<Record<string, string>>({})

  const onUpload = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setTargets({})
    startTransition(() => dispatchPreview(fd))
  }

  const sheets = useMemo(() => preview.sheets ?? [], [preview.sheets])
  const targetOf = (s: PreviewSheet) => targets[s.sheetName] ?? s.suggestedTarget
  const chosen = sheets.filter((s) => !s.error && s.deploys.length > 0 && targetOf(s) !== 'skip')
  const totalRows = chosen.reduce((n, s) => n + s.deploys.length, 0)

  const onConfirm = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const payload = {
      fileName: preview.fileName,
      sheets: chosen.map((s) => ({
        name: s.sheetName.slice(0, 80),
        target: targetOf(s),
        jiraBaseUrl: s.jiraBaseUrl,
        repoUrl: s.repoUrl,
        deploys: s.deploys.map(stripMeta),
      })),
    }
    const fd = new FormData()
    fd.set('payload', JSON.stringify(payload))
    startTransition(() => dispatchCommit(fd))
  }

  return (
    <div className="space-y-8">
      <form onSubmit={onUpload} className="rounded-lg border border-line bg-surface p-5">
        <FormNotice error={preview.error} />
        <label className="label mt-1" htmlFor="file">Arquivo da planilha (.xlsx ou .csv)</label>
        <div className="flex flex-wrap items-center gap-3">
          <input id="file" name="file" type="file" accept=".xlsx,.csv" required className="field max-w-md file:mr-3 file:rounded file:border-0 file:bg-sunken file:px-3 file:py-1 file:text-ink" />
          <SubmitButton busy={previewing} pending="Lendo…" className="btn-quiet">Ler planilha</SubmitButton>
        </div>
        <p className="mt-2 text-sm text-muted">
          No Google Sheets: Arquivo &gt; Fazer download &gt; Microsoft Excel (.xlsx). Cada aba vira um projeto. Nada é gravado antes da sua confirmação.
        </p>
      </form>

      {sheets.length > 0 && (
        <form onSubmit={onConfirm} className="space-y-6">
          <h2 className="text-lg font-semibold">Confira antes de importar</h2>
          <ul className="space-y-4">
            {sheets.map((s) => (
              <SheetPreview
                key={s.sheetName}
                sheet={s}
                target={targetOf(s)}
                onTarget={(v) => setTargets((t) => ({ ...t, [s.sheetName]: v }))}
                projects={projects}
                canManage={canManage}
              />
            ))}
          </ul>
          <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-4 border-t border-line bg-paper/95 px-4 py-4 backdrop-blur md:-mx-0 md:px-0">
            <SubmitButton busy={committing} pending="Importando…">
              {`Importar ${plural(totalRows, 'deploy', 'deploys')}`}
            </SubmitButton>
            <span className="text-sm text-ink-2">Deploys já registrados (mesmo code version, ambiente e data) são pulados.</span>
            <div className="w-full"><FormNotice error={commit.error} /></div>
          </div>
        </form>
      )}
    </div>
  )
}

function SheetPreview({
  sheet: s,
  target,
  onTarget,
  projects,
  canManage,
}: {
  sheet: PreviewSheet
  target: string
  onTarget: (v: string) => void
  projects: ProjectOption[]
  canManage: boolean
}) {
  const id = `sheet-${s.sheetName.replace(/\W+/g, '-')}`
  const usable = !s.error && s.deploys.length > 0
  const withWarnings = s.deploys.filter((d) => d.warnings.length)
  const tasks = new Set(s.deploys.flatMap((d) => d.tasks)).size
  const prs = new Set(s.deploys.flatMap((d) => d.pull_requests.map((p) => p.url))).size
  const prod = s.deploys.filter((d) => d.environment === 'production').length
  const dates = s.deploys.map((d) => d.deployed_on).sort()

  return (
    <li className={`rounded-lg border bg-surface p-5 ${usable && target !== 'skip' ? 'border-line-strong' : 'border-line opacity-70'}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Aba {s.sheetName}</h3>
          {usable ? (
            <p className="text-ink-2">
              {plural(s.deploys.length, 'deploy', 'deploys')} ({prod} em produção), {plural(tasks, 'task', 'tasks')}, {prs} PRs.{' '}
              De {formatDate(dates[0])} a {formatDate(dates[dates.length - 1])}.
            </p>
          ) : (
            <p className="text-ink-2">{s.error ?? 'Nenhum deploy nesta aba.'}</p>
          )}
        </div>
        {usable && (
          <div className="w-full sm:w-64">
            <label className="label" htmlFor={id}>Importar para</label>
            <select id={id} className="field" value={target} onChange={(e) => onTarget(e.target.value)}>
              {canManage && <option value="new">Projeto {s.sheetName} (novo ou de mesmo nome)</option>}
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value="skip">Não importar esta aba</option>
            </select>
          </div>
        )}
      </div>

      {usable && (s.inferredYearCount > 0 || s.swappedDateCount > 0 || s.unlinkedCount > 0 || s.skipped.length > 0 || withWarnings.length > 0) && (
        <div className="mt-4 space-y-2 text-sm">
          {s.unlinkedCount > 0 && (
            <p className="text-hotfix">
              {plural(s.unlinkedCount, 'PR ou commit ficou', 'PRs ou commits ficaram')} sem task definida (linhas com quantidades diferentes de tasks e PRs). Depois da importação, ligue em Vincular PRs.
            </p>
          )}
          {s.swappedDateCount > 0 && (
            <p className="text-ink-2">
              {plural(s.swappedDateCount, 'data estava', 'datas estavam')} com mês e dia trocados (formato americano do Google Sheets). Corrigi pela ordem das linhas.
            </p>
          )}
          {s.inferredYearCount > 0 && (
            <p className="text-ink-2">
              {plural(s.inferredYearCount, 'data estava', 'datas estavam')} sem ano. Completei pela ordem das linhas.
            </p>
          )}
          {s.skipped.length > 0 && (
            <details>
              <summary className="cursor-pointer text-hotfix">{plural(s.skipped.length, 'linha ignorada', 'linhas ignoradas')}</summary>
              <ul className="mt-2 space-y-1 pl-4 text-ink-2">
                {s.skipped.map((r) => <li key={r.sourceRow}>Linha {r.sourceRow}: {r.reason}</li>)}
              </ul>
            </details>
          )}
          {withWarnings.length > 0 && (
            <details>
              <summary className="cursor-pointer text-hotfix">{plural(withWarnings.length, 'linha para conferir', 'linhas para conferir')}</summary>
              <ul className="mt-2 space-y-1 pl-4 text-ink-2">
                {withWarnings.map((d) => (
                  <li key={d.sourceRow}>
                    Linha {d.sourceRow}, <span className="code">{d.code_version}</span>: {d.warnings.join(' ')}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </li>
  )
}
