import { useState, useEffect } from 'react'
import { useAtom } from 'jotai'
import { useNavigate, useParams } from '@tanstack/react-router'
import { nameAtom } from '../atoms/nameAtom'
import { useBroadcaster } from '../hooks/useBroadcaster'

function useLiveTimer(running: boolean) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (!running) { setSeconds(0); return }
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [running])
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0')
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}

export function LiveBroadcasting() {
  const { login } = useParams({ strict: false }) as { login: string }
  const [, setName] = useAtom(nameAtom)
  const navigate = useNavigate()
  const { videoRef, status, error, viewerCount, muted, camOff, facingMode, startStream, stopStream, toggleMute, toggleCam, switchCamera } = useBroadcaster(login)
  const elapsed = useLiveTimer(status === 'live')
  const isLive = status === 'live'

  useEffect(() => { setName(login) }, [login, setName])

  useEffect(() => {
    startStream()
  }, [])

  function handleEnd() {
    stopStream()
    navigate({ to: '/$login/live-init', params: { login } })
  }

  return (
    <div className="flex-1 flex flex-col relative bg-black lg:items-center lg:justify-center lg:p-8">

      <div className="relative flex-1 lg:flex-none lg:w-full lg:max-w-4xl lg:aspect-video lg:rounded-2xl overflow-hidden bg-zinc-900">

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover ${camOff ? 'hidden' : 'block'}`}
        />

        {camOff && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-zinc-700 flex items-center justify-center text-3xl font-bold text-white mx-auto mb-3">
                {login[0].toUpperCase()}
              </div>
              <p className="text-zinc-400 text-sm">Camera off</p>
            </div>
          </div>
        )}

        {status === 'requesting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
            <p className="text-zinc-400 text-sm animate-pulse">Starting camera…</p>
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-900 px-6 text-center">
            <span className="text-4xl">⚠️</span>
            <p className="text-zinc-300 text-sm">{error}</p>
            <button onClick={startStream} className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-xl text-white text-sm font-medium">
              Try again
            </button>
          </div>
        )}

        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
          {isLive ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-red-600 px-2.5 py-1 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-xs font-bold text-white">LIVE</span>
              </div>
              <span className="text-xs text-white/70 font-mono">{elapsed}</span>
            </div>
          ) : <div />}

          {isLive && (
            <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-md">
              <span className="text-sm">👁️</span>
              <span className="text-xs text-white font-medium">{viewerCount}</span>
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-4 bg-gradient-to-t from-black/70 to-transparent">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              disabled={!isLive}
              className={`w-11 h-11 rounded-full flex items-center justify-center text-lg transition-colors disabled:opacity-30 ${
                muted ? 'bg-red-600/80' : 'bg-white/10 hover:bg-white/20 backdrop-blur-sm'
              }`}
            >
              {muted ? '🔇' : '🎙️'}
            </button>

            <button
              onClick={toggleCam}
              disabled={!isLive}
              className={`w-11 h-11 rounded-full flex items-center justify-center text-lg transition-colors disabled:opacity-30 ${
                camOff ? 'bg-red-600/80' : 'bg-white/10 hover:bg-white/20 backdrop-blur-sm'
              }`}
            >
              {camOff ? '📵' : '📹'}
            </button>

            <button
              onClick={switchCamera}
              disabled={!isLive || camOff}
              title={facingMode === 'user' ? 'Switch to rear camera' : 'Switch to front camera'}
              className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center text-lg transition-colors disabled:opacity-30"
            >
              🔄
            </button>
          </div>

          <button
            onClick={handleEnd}
            className="px-4 py-2.5 rounded-xl bg-red-600/90 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
          >
            End Stream
          </button>
        </div>
      </div>

      <div className="hidden lg:flex lg:w-full lg:max-w-4xl mt-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex-col h-52">
        <h2 className="text-sm font-semibold text-zinc-400 mb-3">Live Chat</h2>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-zinc-600 italic">
            {isLive ? 'Share the viewer link to see chat here.' : 'Chat will appear when you go live.'}
          </p>
        </div>
        <div className="flex gap-2 mt-3">
          <input
            type="text"
            placeholder="Say something…"
            disabled={!isLive}
            className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm outline-none focus:border-red-500 transition-colors placeholder-zinc-600 disabled:opacity-40"
          />
          <button disabled={!isLive} className="px-3 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white text-sm transition-colors disabled:opacity-40">
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
