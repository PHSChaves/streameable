import { useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useViewer } from '../hooks/useViewer'

const MOCK_CHAT = [
  { id: 1, user: 'StreamFan99', msg: "let's go! 🔥" },
  { id: 2, user: 'ViewerX', msg: "Just joined, what's happening?" },
  { id: 3, user: 'LuckyDuck', msg: 'Amazing stream!' },
]

export function LiveViewer() {
  const { login } = useParams({ strict: false }) as { login: string }
  const navigate = useNavigate()
  const { videoRef, status, forceMuted, unmute } = useViewer()
  const [message, setMessage] = useState('')
  const [chat, setChat] = useState(MOCK_CHAT)
  const [chatOpen, setChatOpen] = useState(false)
  // Viewer's own display name for chat (independent of broadcaster login)
  const [viewerName, setViewerName] = useState('')
  const [nameConfirmed, setNameConfirmed] = useState(false)
  const isWatching = status === 'watching'

  function sendMessage(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = message.trim()
    if (!trimmed) return
    setChat((prev) => [...prev, { id: Date.now(), user: viewerName || 'You', msg: trimmed }])
    setMessage('')
  }

  const statusMessage: Record<typeof status, string> = {
    connecting: 'Connecting…',
    waiting: `Waiting for ${login} to go live…`,
    watching: 'Live',
    'no-stream': 'Stream has ended',
    error: 'Could not connect to signaling server',
  }

  // Name prompt shown when chat is opened and viewer hasn't set a name yet
  function NamePrompt() {
    const [input, setInput] = useState('')
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/95 backdrop-blur-sm z-10 rounded-t-2xl lg:rounded-2xl p-6 gap-4">
        <p className="text-zinc-300 font-medium text-sm">Enter your name to chat</p>
        <form
          onSubmit={(e) => { e.preventDefault(); const v = input.trim(); if (v) { setViewerName(v); setNameConfirmed(true) } }}
          className="flex gap-2 w-full max-w-xs"
        >
          <input
            autoFocus
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Your name…"
            className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm outline-none focus:border-red-500 transition-colors placeholder-zinc-600"
          />
          <button type="submit" className="px-3 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white text-sm">
            Join
          </button>
        </form>
      </div>
    )
  }

  return (
    // Full screen on mobile
    <div className="flex-1 flex flex-col relative bg-black">

      {/* ── Video (fills entire screen on mobile) ───────────────────── */}
      <div className="relative flex-1 lg:flex-none lg:max-w-4xl lg:w-full lg:mx-auto lg:mt-6 lg:aspect-video lg:rounded-2xl overflow-hidden bg-zinc-900">

        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`absolute inset-0 w-full h-full object-cover ${isWatching ? 'block' : 'hidden'}`}
        />

        {/* Placeholder states */}
        {!isWatching && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-900 text-center px-6">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center text-3xl">
              {status === 'connecting' || status === 'waiting' ? '⏳' : status === 'error' ? '⚠️' : '📡'}
            </div>
            <div>
              <p className="text-zinc-300 font-medium">{statusMessage[status]}</p>
              {(status === 'no-stream' || status === 'error') && (
                <p className="text-zinc-500 text-sm mt-1">Nobody is live right now</p>
              )}
            </div>
            {status === 'no-stream' && (
              <button
                onClick={() => navigate({ to: '/$login/live-init', params: { login } })}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Start a stream
              </button>
            )}
            {(status === 'connecting' || status === 'waiting') && (
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-2 h-2 rounded-full bg-red-500 animate-pulse"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Muted banner (autoplay policy fallback) ──────────────────── */}
        {isWatching && forceMuted && (
          <button
            onClick={unmute}
            className="absolute inset-0 flex items-center justify-center bg-black/40 z-20"
          >
            <div className="flex items-center gap-2 bg-zinc-900/90 px-5 py-3 rounded-2xl border border-zinc-700">
              <span className="text-xl">🔇</span>
              <span className="text-white text-sm font-semibold">Tap to unmute</span>
            </div>
          </button>
        )}

        {/* ── TOP overlay ─────────────────────────────────────────────── */}
        {isWatching && (
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
            <div className="flex items-center gap-1.5 bg-red-600 px-2.5 py-1 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span className="text-xs font-bold text-white">LIVE</span>
            </div>

            {/* Mobile chat toggle */}
            <button
              onClick={() => setChatOpen((o) => !o)}
              className="lg:hidden w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white text-sm"
            >
              💬
            </button>
          </div>
        )}

        {/* ── BOTTOM actions overlay ───────────────────────────────────── */}
        {isWatching && (
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-4 bg-gradient-to-t from-black/70 to-transparent">
            <div className="flex items-center gap-2">
              <button className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center text-lg transition-colors">
                👍
              </button>
              <button className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center text-lg transition-colors">
                🔔
              </button>
              <button className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center text-lg transition-colors">
                🔗
              </button>
            </div>

            <button
              onClick={() => navigate({ to: '/$login/live-init', params: { login } })}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white text-xs font-medium transition-colors"
            >
              🔴 Go Live
            </button>
          </div>
        )}

        {/* ── Mobile chat drawer (slide up from bottom) ───────────────── */}
        {chatOpen && isWatching && (
          <div className="lg:hidden absolute inset-x-0 bottom-0 h-3/4 bg-zinc-900/95 backdrop-blur-sm flex flex-col rounded-t-2xl">
            {!nameConfirmed && <NamePrompt />}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-300">Live Chat</h2>
              <button onClick={() => setChatOpen(false)} className="text-zinc-500 hover:text-white text-lg">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-3 px-4 py-3">
              {chat.map((entry) => (
                <div key={entry.id}>
                  <span className={`text-xs font-semibold ${entry.user === viewerName ? 'text-red-400' : 'text-zinc-400'}`}>
                    {entry.user === viewerName ? `${entry.user} (you)` : entry.user}
                  </span>
                  <p className="text-sm text-zinc-200">{entry.msg}</p>
                </div>
              ))}
            </div>

            <form onSubmit={sendMessage} className="flex gap-2 px-4 py-3 border-t border-zinc-800">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={viewerName ? `Chat as ${viewerName}…` : 'Say something…'}
                className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm outline-none focus:border-red-500 transition-colors placeholder-zinc-600"
              />
              <button type="submit" className="px-3 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white text-sm">
                Send
              </button>
            </form>
          </div>
        )}
      </div>

      {/* ── Desktop side-by-side layout ─────────────────────────────── */}
      <div className="hidden lg:flex max-w-4xl w-full mx-auto mt-4 mb-6 gap-4 px-4">
        {/* Reactions row */}
        <div className="flex-1 flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 text-sm font-medium">
            👍 Like
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 text-sm font-medium">
            🔔 Follow
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 text-sm font-medium">
            🔗 Share
          </button>
        </div>

        {/* Desktop chat panel */}
        <div className="w-72 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col h-56 relative">
          {!nameConfirmed && chatOpen === false && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/95 backdrop-blur-sm z-10 rounded-2xl p-4 gap-3">
              <p className="text-zinc-300 font-medium text-sm">Enter your name to chat</p>
              <form
                onSubmit={(e) => { e.preventDefault(); const v = (e.currentTarget.querySelector('input') as HTMLInputElement).value.trim(); if (v) { setViewerName(v); setNameConfirmed(true) } }}
                className="flex gap-2 w-full"
              >
                <input
                  type="text"
                  placeholder="Your name…"
                  className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm outline-none focus:border-red-500 transition-colors placeholder-zinc-600"
                />
                <button type="submit" className="px-3 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white text-sm">
                  Join
                </button>
              </form>
            </div>
          )}
          <h2 className="text-sm font-semibold text-zinc-400 mb-3">
            Live Chat <span className="text-zinc-600 font-normal text-xs">{chat.length}</span>
          </h2>
          <div className="flex-1 overflow-y-auto flex flex-col gap-2.5">
            {chat.map((entry) => (
              <div key={entry.id}>
                <span className={`text-xs font-semibold ${entry.user === viewerName ? 'text-red-400' : 'text-zinc-400'}`}>
                  {entry.user === viewerName ? `${entry.user} (you)` : entry.user}
                </span>
                <p className="text-sm text-zinc-200">{entry.msg}</p>
              </div>
            ))}
          </div>
          <form onSubmit={sendMessage} className="mt-3 flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={viewerName ? `Chat as ${viewerName}…` : 'Join to chat…'}
              disabled={!nameConfirmed}
              className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm outline-none focus:border-red-500 transition-colors placeholder-zinc-600 disabled:opacity-40"
            />
            <button type="submit" disabled={!nameConfirmed} className="px-3 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white text-sm disabled:opacity-40">
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
