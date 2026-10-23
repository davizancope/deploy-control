export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex items-center gap-3">
          <svg width="36" height="36" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="7" className="fill-ink" />
            <path d="M6 21h20" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" />
            <circle cx="11" cy="21" r="3" fill="var(--paper)" stroke="var(--staging)" strokeWidth="2" />
            <path d="M21 15.5l4.5 5.5-4.5 5.5-4.5-5.5z" fill="var(--production)" />
          </svg>
          <span className="text-lg font-semibold tracking-tight">Deploy Control</span>
        </div>
        {children}
      </div>
    </main>
  )
}
