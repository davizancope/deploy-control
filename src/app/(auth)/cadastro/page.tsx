import type { Metadata } from 'next'
import Link from 'next/link'
import { SignUpForm } from '../forms'

export const metadata: Metadata = { title: 'Criar conta' }

export default function SignUpPage() {
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Criar conta</h1>
      <p className="mb-6 text-ink-2">Depois de confirmar o e-mail, você cria a organização do seu time.</p>
      <SignUpForm />
      <p className="mt-6 text-sm text-ink-2">
        Já tem conta? <Link className="link" href="/login">Entrar</Link>
      </p>
    </>
  )
}
