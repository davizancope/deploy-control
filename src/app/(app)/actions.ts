'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getMyOrgs, ORG_COOKIE } from '@/lib/session'

export async function switchOrg(formData: FormData) {
  const id = String(formData.get('org') ?? '')
  const orgs = await getMyOrgs()
  if (id === '__new') redirect('/onboarding')
  if (!orgs.some((o) => o.id === id)) redirect('/')
  ;(await cookies()).set(ORG_COOKIE, id, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 365 })
  redirect('/')
}
