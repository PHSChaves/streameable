import { useEffect, useRef, useState } from 'react'
import { useAtom } from 'jotai'
import { useNavigate, useParams } from '@tanstack/react-router'
import { nameAtom } from '../atoms/nameAtom'

export function LiveInit() {
  const { login } = useParams({ strict: false }) as { login: string }
  const [, setName] = useAtom(nameAtom)
  const navigate = useNavigate()

  const previewRef = useRef<HTMLVideoElement>(null)
  const [camReady, setCamReady] = useState(false)
  const [camError, setCamError] = useState(false)
  const [title, setTitle] = useState(`${login}'s Stream`)
  const [category, setCategory] = useState('IRL')

  // Sync URL login → nameAtom so Layout shows it
  useEffect(() => { setName(login) }, [login, setName])

  // Local camera preview — no WebRTC
  useEffect(() => {
    let stream: MediaStream
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((s) => {
        stream = s
        if (previewRef.current) { previewRef.current.srcObject = s; setCamReady(true) }
      })
      .catch(() => setCamError(true))
    return () => stream?.getTracks().forEach((t) => t.stop())
  }, [])

  function goLive() {
    const stream = previewRef.current?.srcObject as MediaStream | null
    stream?.getTracks().forEach((t) => t.stop())
    navigate({ to: '/$login/live-broadcasting', params: { login } })
  }

  return (
    <div className="flex-1 flex flex-col w-full max-w-2xl mx-auto px-4 py-6 gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-red-400 mb-1">Setup</p>
        <h1 className="text-2xl font-bold text-white">Stream Setup</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Hey <span className="text-white font-medium">{login}</span>, configure your stream before going live.
        </p>
      </div>

      {/* Camera preview */}
      <div className="relative aspect-video w-full bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
        <video
          ref={previewRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${camReady ? 'block' : 'hidden'}`}
        />
        {!camReady && !camError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-zinc-500 text-sm animate-pulse">Requesting camera…</p>
          </div>
        )}
        {camError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <span className="text-3xl">📵</span>
            <p className="text-zinc-500 text-sm">Camera unavailable</p>
            <p className="text-zinc-600 text-xs">You can still go live without a preview</p>
          </div>
        )}
        {camReady && (
          <div className="absolute top-2 left-2 bg-black/50 text-xs text-zinc-300 px-2 py-1 rounded-md">
            Preview
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Stream title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm outline-none focus:border-red-500 transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Category</label>
          <div className="grid grid-cols-4 gap-2">
            {['IRL', 'Gaming', 'Music', 'Talk'].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`py-2 rounded-xl text-sm font-medium transition-colors border ${
                  category === cat
                    ? 'bg-red-600 border-red-600 text-white'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1" />

      <button
        onClick={goLive}
        className="w-full py-4 rounded-2xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold text-lg transition-colors flex items-center justify-center gap-3"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
        Go Live
      </button>
    </div>
  )
}
