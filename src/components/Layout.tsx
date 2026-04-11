interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {

  return (
    <div className="min-h-dvh flex flex-col bg-zinc-950">
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  )
}
