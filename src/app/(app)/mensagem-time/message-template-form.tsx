'use client'

import { useRef, useState } from 'react'
import { FieldError, FormNotice, SubmitButton } from '@/components/ui'
import { useFormAction } from '@/components/use-form-action'
import {
  DEFAULT_MESSAGE_TEMPLATE,
  MESSAGE_PLACEHOLDERS,
  SAMPLE_DEPLOY,
  findUnknownPlaceholders,
  markdownToHtml,
  messageVars,
  renderTemplate,
} from '@/lib/release-message'
import { saveMessageTemplate } from './actions'

export function MessageTemplateForm({ initial, canEdit }: { initial: string; canEdit: boolean }) {
  const { state, onSubmit, pending } = useFormAction(saveMessageTemplate)
  const [body, setBody] = useState(initial)
  const area = useRef<HTMLTextAreaElement>(null)
  const unknown = findUnknownPlaceholders(body)
  const previewHtml = markdownToHtml(renderTemplate(body, messageVars(SAMPLE_DEPLOY)))

  function insert(key: string) {
    const token = `{{${key}}}`
    const el = area.current
    if (!el) {
      setBody((current) => current + token)
      return
    }
    const { selectionStart: start, selectionEnd: end } = el
    setBody(body.slice(0, start) + token + body.slice(end))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + token.length, start + token.length)
    })
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <FormNotice error={state.error} message={state.message} />
        <div>
          <label className="label" htmlFor="body">Mensagem</label>
          <textarea
            ref={area}
            id="body"
            name="body"
            className="field code min-h-72 leading-relaxed"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            readOnly={!canEdit}
            spellCheck={false}
            aria-describedby="body-hint"
          />
          <p id="body-hint" className="mt-1.5 text-sm text-muted">
            Aceita markdown: **negrito**, listas com “-”, [texto](link) e URLs soltas. Os campos {'{{assim}}'} são trocados pelos dados do deploy.
          </p>
          <FieldError message={state.fieldErrors?.body} />
          {unknown.length > 0 && (
            <p role="status" className="mt-1.5 text-sm text-hotfix">
              Campo{unknown.length > 1 ? 's' : ''} que não existe{unknown.length > 1 ? 'm' : ''}: {unknown.map((k) => `{{${k}}}`).join(', ')}. {unknown.length > 1 ? 'Ficarão' : 'Ficará'} como escrito{unknown.length > 1 ? 's' : ''} na mensagem.
            </p>
          )}
        </div>
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            <SubmitButton busy={pending}>Salvar mensagem</SubmitButton>
            <button type="button" className="btn-quiet" onClick={() => setBody(DEFAULT_MESSAGE_TEMPLATE)}>Restaurar modelo padrão</button>
          </div>
        ) : (
          <p className="text-sm text-ink-2">Só donos e admins editam a mensagem.</p>
        )}
      </div>

      <div className="space-y-8">
        <section aria-labelledby="preview-h">
          <h2 id="preview-h" className="mb-1 text-lg font-semibold">Prévia</h2>
          <p className="mb-3 text-sm text-muted">Com dados de exemplo.</p>
          <div
            className="space-y-3 rounded-lg border border-line bg-surface p-4 text-[15px] [&_a]:pointer-events-none [&_a]:underline [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </section>

        <section aria-labelledby="campos-h">
          <h2 id="campos-h" className="mb-3 text-lg font-semibold">Campos disponíveis</h2>
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {MESSAGE_PLACEHOLDERS.map((p) => (
              <li key={p.key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2.5">
                <button
                  type="button"
                  className="code rounded border border-line bg-sunken px-1.5 py-0.5 text-sm hover:border-ink disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => insert(p.key)}
                  disabled={!canEdit}
                  aria-label={`Inserir {{${p.key}}} na mensagem`}
                >
                  {`{{${p.key}}}`}
                </button>
                <span className="text-sm text-ink-2">{p.description}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </form>
  )
}
