import { BrandMark } from '@/components/icons'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex items-center gap-3">
          <BrandMark size={40} />
          <span className="text-lg font-semibold tracking-tight">Deploy Control</span>
        </div>
        <div className="glass rounded-3xl p-7">{children}</div>
      </div>
    </main>
  )
}
