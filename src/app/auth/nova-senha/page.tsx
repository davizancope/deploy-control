import type { Metadata } from 'next'
import AuthLayout from '@/app/(auth)/layout'
import { NewPasswordForm } from '@/app/(auth)/forms'

export const metadata: Metadata = { title: 'Nova senha' }

export default function NewPasswordPage() {
  return (
    <AuthLayout>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Criar nova senha</h1>
      <p className="mb-6 text-ink-2">Ela passa a valer assim que você salvar.</p>
      <NewPasswordForm />
    </AuthLayout>
  )
}
