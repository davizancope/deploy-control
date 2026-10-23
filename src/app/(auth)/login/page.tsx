import type { Metadata } from 'next'
import Link from 'next/link'
import { safeNext } from '@/lib/session'
import { LoginForm } from '../forms'

export const metadata: Metadata = { title: 'Entrar' }

const NOTICES: Record<string, string> = {
  link: 'O link expirou ou já foi usado. Entre com sua senha ou peça um novo.',
}

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const sp = await searchParams
  const erro = typeof sp.erro === 'string' ? NOTICES[sp.erro] : undefined
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Entrar</h1>
      <p className="mb-6 text-ink-2">Registre e acompanhe os deploys dos seus projetos.</p>
      <LoginForm next={safeNext(sp.next)} notice={erro} />
      <p className="mt-6 text-sm text-ink-2">
        Ainda não tem conta? <Link className="link" href="/cadastro">Criar conta</Link>
      </p>
    </>
  )
}
