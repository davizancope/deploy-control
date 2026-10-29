'use client'

import { FieldError, FormNotice } from '@/components/ui'
import { useFormAction } from '@/components/use-form-action'
import { plural } from '@/lib/format'
import { deleteProject } from './actions'

/**
 * Exclusão definitiva de um projeto, protegida por confirmação digitando o nome.
 * @param props.id ID do projeto.
 * @param props.name Nome do projeto, que a pessoa precisa digitar.
 * @param props.deploys Quantidade de deploys que serão apagados junto.
 * @returns Formulário dentro de um bloco recolhido.
 */
export function DeleteProjectForm({ id, name, deploys }: { id: string; name: string; deploys: number }) {
  const { state, onSubmit, pending } = useFormAction(deleteProject)
  const inputId = `del-${id}`
  return (
    <details className="border-t border-line pt-4">
      <summary className="cursor-pointer text-sm text-danger hover:underline">Excluir projeto</summary>
      <form onSubmit={onSubmit} className="mt-3 space-y-3" noValidate>
        <FormNotice error={state.error} />
        <input type="hidden" name="id" value={id} />
        <p className="text-sm">
          Isso apaga <strong>{name}</strong> de vez, com {deploys ? plural(deploys, 'deploy', 'deploys') : 'nenhum deploy'} e tudo o que está ligado a ele (tasks, PRs, commits e merges de branch). Não dá para desfazer. Para só tirar o projeto das telas, use Arquivar.
        </p>
        <div>
          <label className="label" htmlFor={inputId}>Digite o nome do projeto para confirmar</label>
          <input className="field" id={inputId} name="confirm" autoComplete="off" spellCheck={false} placeholder={name} />
          <FieldError message={state.fieldErrors?.confirm} />
        </div>
        <button type="submit" className="btn-danger" disabled={pending}>{pending ? 'Excluindo…' : 'Excluir definitivamente'}</button>
      </form>
    </details>
  )
}
