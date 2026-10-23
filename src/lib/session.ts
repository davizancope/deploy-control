import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { OrgRole } from '@/lib/types'

export const ORG_COOKIE = 'dc_org'

export type OrgSummary = { id: string; name: string; role: OrgRole }

type MembershipRow = { role: OrgRole; org_id: string; organizations: { id: string; name: string } | null }

/**
 * Usuário logado (JWT validado pelo Supabase), ou null.
 * @returns Cliente Supabase da requisição e dados básicos do usuário.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims?.sub) return null
  return { supabase, id: claims.sub, email: typeof claims.email === 'string' ? claims.email : '' }
})

/**
 * Organizações das quais o usuário é membro.
 * @returns Lista ordenada por nome.
 */
export const getMyOrgs = cache(async (): Promise<OrgSummary[]> => {
  const user = await getCurrentUser()
  if (!user) return []
  const { data, error } = await user.supabase
    .from('memberships')
    .select('role, org_id, organizations(id, name)')
    .eq('user_id', user.id)
  if (error) throw new Error(`Não consegui carregar suas organizações: ${error.message}`)
  return ((data ?? []) as unknown as MembershipRow[])
    .filter((m) => m.organizations)
    .map((m) => ({ id: m.org_id, name: m.organizations!.name, role: m.role }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
})

/**
 * Contexto das páginas internas: usuário, organização ativa e permissões. Redireciona se faltar algo.
 * @returns Cliente Supabase, usuário, organização ativa e as demais organizações.
 */
export const requireContext = cache(async () => {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgs = await getMyOrgs()
  if (orgs.length === 0) redirect('/onboarding')
  const wanted = (await cookies()).get(ORG_COOKIE)?.value
  const org = orgs.find((o) => o.id === wanted) ?? orgs[0]
  return {
    supabase: user.supabase,
    user: { id: user.id, email: user.email },
    org,
    orgs,
    canWrite: org.role !== 'viewer',
    canManage: org.role === 'owner' || org.role === 'admin',
  }
})

export type AppContext = Awaited<ReturnType<typeof requireContext>>

/**
 * Garante que o destino de um redirect é um caminho interno.
 * @param next Valor vindo da URL ou do formulário.
 * @param fallback Caminho usado quando o valor não é seguro.
 * @returns Caminho relativo seguro.
 */
export function safeNext(next: unknown, fallback = '/'): string {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback
  return next
}
