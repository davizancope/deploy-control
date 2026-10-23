import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import AuthLayout from '@/app/(auth)/layout'
import { getCurrentUser, getMyOrgs } from '@/lib/session'
import { OrgForm } from './form'

export const metadata: Metadata = { title: 'Criar organização' }

export default async function OnboardingPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgs = await getMyOrgs()

  return (
    <AuthLayout>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Sua organização</h1>
      <p className="mb-6 text-ink-2">
        É o espaço do seu time: projetos, deploys e pessoas ficam dentro dela e ninguém de fora vê.
      </p>
      <OrgForm />
      {orgs.length > 0 && (
        <p className="mt-6 text-sm text-ink-2">
          <Link className="link" href="/">Voltar para {orgs[0].name}</Link>
        </p>
      )}
    </AuthLayout>
  )
}
