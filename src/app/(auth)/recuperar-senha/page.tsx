import type { Metadata } from 'next'
import Link from 'next/link'
import { ResetRequestForm } from '../forms'

export const metadata: Metadata = { title: 'Recuperar senha' }

export default function ResetPage() {
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Recuperar senha</h1>
      <p className="mb-6 text-ink-2">Enviamos um link para você criar uma senha nova.</p>
      <ResetRequestForm />
      <p className="mt-6 text-sm text-ink-2">
        <Link className="link" href="/login">Voltar para o login</Link>
      </p>
    </>
  )
}
