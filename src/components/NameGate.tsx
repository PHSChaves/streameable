import { useState } from 'react'
import { useAtom } from 'jotai'
import { useNavigate, useLocation } from '@tanstack/react-router'
import { nameAtom } from '../atoms/nameAtom'

interface NameGateProps {
  children: React.ReactNode
}

async function fetchBroadcasterName(): Promise<string | null> {
  try {
    const res = await fetch('http://localhost:8080/api/broadcaster')
    const data = await res.json()
    return data.name ?? null
  } catch {
    return null
  }
}

export function NameGate({ children }: NameGateProps) {
  const [name, setName] = useAtom(nameAtom)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  const navigate = useNavigate()
  const location = useLocation()

  // Name already set — just render the page
  if (name) return <>{children}</>

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) {
      setError('Please enter your name to continue.')
      return
    }

    // live-init is the setup page — set name and stay there
    if (location.pathname === '/live-init') {
      setName(trimmed)
      return
    }

    // For every other URL: check who is currently broadcasting
    setChecking(true)
    const broadcasterName = await fetchBroadcasterName()
    setName(trimmed)

    if (broadcasterName === trimmed) {
      // This user IS the broadcaster — send them back to their stream
      navigate({ to: '/live-broadcasting' })
    } else {
      // Not the broadcaster — go watch
      navigate({ to: '/live-viewer' })
    }

    setChecking(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4 bg-zinc-900 border border-zinc-700 rounded-2xl p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 mb-4">
            <span className="text-2xl">📡</span>
          </div>
          <h1 className="text-xl font-semibold text-white">Welcome to LiveCam</h1>
          <p className="text-sm text-zinc-400 mt-1">Enter your name to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name-input" className="text-sm font-medium text-zinc-300">
              Your name
            </label>
            <input
              id="name-input"
              type="text"
              autoFocus
              value={input}
              disabled={checking}
              onChange={(e) => { setInput(e.target.value); setError('') }}
              placeholder="e.g. Alice"
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-800 border border-zinc-600 text-white placeholder-zinc-500 outline-none focus:border-red-500 transition-colors disabled:opacity-50"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={checking}
            className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {checking ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Checking…
              </>
            ) : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
