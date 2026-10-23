import type { Metadata } from 'next'
import { getMessageTemplate } from '@/lib/data'
import { requireContext } from '@/lib/session'
import { MessageTemplateForm } from './message-template-form'

export const metadata: Metadata = { title: 'Mensagem ao time' }

export default async function MessageTemplatePage() {
  const ctx = await requireContext()
  const template = await getMessageTemplate(ctx)
  return (
    <>
      <header className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight">Mensagem ao time</h1>
        <p className="text-ink-2">
          Texto padrão para avisar o time de uma nova release. Em cada deploy, o botão “Copiar mensagem ao time” preenche os campos com os dados dele.
        </p>
      </header>
      <MessageTemplateForm initial={template} canEdit={ctx.canManage} />
    </>
  )
}
