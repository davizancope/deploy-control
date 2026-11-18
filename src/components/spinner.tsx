/**
 * Spinner circular que herda a cor do texto; decorativo (quem usa deve ter um texto ou aria-busy ao lado).
 * @param props.size Lado em pixels.
 * @param props.className Classes extras (posicionamento, margem).
 * @returns SVG animado.
 */
export function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`shrink-0 animate-spin ${className}`}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Estado de carregamento de página: esqueleto do cabeçalho, spinner com texto e blocos de conteúdo.
 * @param props.label Texto lido por leitores de tela e exibido ao lado do spinner.
 * @returns Região de status com o esqueleto.
 */
export function PageLoading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <div className="mb-8 space-y-3" aria-hidden="true">
        <div className="h-8 w-56 max-w-full animate-pulse rounded-xl bg-sunken" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-lg bg-sunken" />
      </div>
      <p className="mb-6 flex items-center gap-2.5 text-ink-2">
        <Spinner size={18} />
        {label}
      </p>
      <div className="space-y-3" aria-hidden="true">
        <div className="h-24 animate-pulse rounded-2xl bg-sunken" />
        <div className="h-24 animate-pulse rounded-2xl bg-sunken" />
        <div className="h-24 animate-pulse rounded-2xl bg-sunken" />
      </div>
    </div>
  )
}
