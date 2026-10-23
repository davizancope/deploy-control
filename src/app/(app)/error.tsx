'use client'

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="max-w-xl py-10">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Algo deu errado ao carregar esta página</h1>
      <p className="mb-6 text-ink-2">
        {error.message.includes('Variável de ambiente') ? error.message : 'Tente de novo. Se continuar, confira se o banco foi configurado com a migration.'}
      </p>
      <button type="button" onClick={reset} className="btn-primary">Tentar de novo</button>
      {error.digest && <p className="mt-4 text-sm text-muted">Código: {error.digest}</p>}
    </div>
  )
}
