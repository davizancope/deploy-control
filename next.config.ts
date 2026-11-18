import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Planilhas maiores que o limite padrão de 1 MB das Server Actions.
    serverActions: { bodySizeLimit: '6mb' },
    // Voltar a uma tela visitada há menos de 30 s reaproveita o cache do cliente; mutações invalidam via revalidatePath.
    staleTimes: { dynamic: 30 },
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
