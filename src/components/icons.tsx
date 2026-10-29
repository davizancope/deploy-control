import { useId } from 'react'
import type { DeployType, Environment } from '@/lib/types'

export type IconName = Environment | DeployType | 'merge' | 'eye' | 'eye-off' | 'check'

/* Traçados em grade 24x24, contorno de 1,75: staging = frasco, produção = foguete, merge = ramal que se junta, release = pacote, bugfix = inseto, hotfix = chama, eye/eye-off = mostrar/ocultar, check = confirmado. */
const PATHS: Record<IconName, string[]> = {
  staging: [
    'M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2',
    'M8.5 2h7',
    'M7 16h10',
  ],
  production: [
    'M12 2.5c3 2.4 4.5 5.6 4.5 9.4L14.6 17H9.4l-1.9-5.1C7.5 8.1 9 4.9 12 2.5z',
    'M9.4 17 7 20.5',
    'M14.6 17l2.4 3.5',
    'M12 17.5v4',
    'M12 7.4a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4z',
  ],
  eye: [
    'M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0',
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  ],
  'eye-off': [
    'M10.73 5.08a10.74 10.74 0 0 1 11.21 6.57 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-1.44 2.49',
    'M14.08 14.16a3 3 0 0 1-4.24-4.24',
    'M17.48 17.5a10.75 10.75 0 0 1-15.42-5.15 1 1 0 0 1 0-.7 10.75 10.75 0 0 1 4.45-5.14',
    'm2 2 20 20',
  ],
  check: ['M20 6 9 17l-5-5'],
  merge: ['M15 18a3 3 0 1 0 6 0 3 3 0 1 0-6 0', 'M3 6a3 3 0 1 0 6 0 3 3 0 1 0-6 0', 'M6 21V9a9 9 0 0 0 9 9'],
  release: ['M12 2.8 20 7.2v9.6L12 21.2 4 16.8V7.2z', 'm4 7.2 8 4.4 8-4.4', 'M12 11.6v9.6'],
  bugfix: [
    'm8 2 1.88 1.88',
    'M14.12 3.88 16 2',
    'M9 7.13v-1a3.003 3.003 0 1 1 6 0v1',
    'M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6',
    'M12 20v-9',
    'M6.53 9C4.6 8.8 3 7.1 3 5',
    'M6 13H2',
    'M3 21c0-2.1 1.7-3.9 3.8-4',
    'M20.97 5c0 2.1-1.6 3.8-3.5 4',
    'M22 13h-4',
    'M17.2 17c2.1.1 3.8 1.9 3.8 4',
  ],
  hotfix: [
    'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z',
  ],
}

/**
 * Ícone de ambiente (staging, produção), de tipo de deploy (release, bugfix, hotfix) ou de interface (eye, eye-off, check); herda a cor do texto.
 * @param props.name Nome do ícone.
 * @param props.size Lado em pixels.
 * @param props.className Classe extra, normalmente a cor.
 * @returns SVG decorativo.
 */
export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}

/**
 * Logo do app: ladrilho de vidro com um losango (o que chega em produção) sobre a base da plataforma.
 * @param props.size Lado em pixels.
 * @returns SVG decorativo.
 */
export function BrandMark({ size = 28 }: { size?: number }) {
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2f7bff" />
          <stop offset="0.5" stopColor="#25b3dc" />
          <stop offset="1" stopColor="#2fd27d" />
        </linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id}g)`} />
      <rect width="32" height="32" rx="9" fill={`url(#${id}s)`} />
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="none" stroke="#fff" strokeOpacity="0.5" />
      <path d="M16 6.5 24.5 15 16 23.5 7.5 15z" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M16 11.2 19.8 15 16 18.8 12.2 15z" fill="#fff" />
      <path d="M9 26.2h14" stroke="#fff" strokeOpacity="0.7" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
