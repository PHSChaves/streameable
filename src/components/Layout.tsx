import { useAtomValue } from 'jotai'
import { nameAtom } from '../atoms/nameAtom'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const name = useAtomValue(nameAtom)

  return (
    <div className="min-h-dvh flex flex-col bg-zinc-950">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur sticky top-0 z-40 shrink-0">
        <div className="px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">📡</span>
            <span className="font-bold text-white text-sm tracking-wide">LiveCam</span>
          </div>

          {name && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-bold">
                {name[0].toUpperCase()}
              </div>
              <span className="text-sm text-zinc-300 hidden sm:inline">{name}</span>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  )
}
