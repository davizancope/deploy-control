import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="grid min-h-[60dvh] place-items-center px-4">
      <div className="max-w-md text-center">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">Página não encontrada</h1>
        <p className="mb-6 text-ink-2">O endereço não existe ou é de uma organização à qual você não tem acesso.</p>
        <Link href="/" className="btn-primary">Ir para o painel</Link>
      </div>
    </main>
  )
}
