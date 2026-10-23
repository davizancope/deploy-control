function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Variável de ambiente ${name} não configurada. Confira o arquivo .env.local.`)
  return value
}

// Acesso direto a process.env.NEXT_PUBLIC_* para o Next conseguir embutir os valores no bundle do navegador.
export const env = {
  supabaseUrl: () => required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseKey: () =>
    required(
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
  siteUrl: () => (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, ''),
}
