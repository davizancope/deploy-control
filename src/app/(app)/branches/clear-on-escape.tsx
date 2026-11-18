'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Limpa a seleção de branch ao apertar Esc, sem interferir em campos de formulário.
 * @param props.href URL da página sem a branch selecionada.
 * @returns Nada: só registra o atalho.
 */
export function ClearOnEscape({ href }: { href: string }) {
  const router = useRouter()
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const el = e.target as HTMLElement | null
      if (el?.closest('input, select, textarea, [contenteditable]')) return
      router.push(href)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [href, router])
  return null
}
