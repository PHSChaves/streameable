import { useEffect, useRef, useState } from 'react'
import { useAtom } from 'jotai'
import { useNavigate, useParams } from '@tanstack/react-router'
import { nameAtom } from '../atoms/nameAtom'

export function LiveInit() {
  const { login } = useParams({ strict: false }) as { login: string }
  const [, setName] = useAtom(nameAtom)
  const navigate = useNavigate()

  const previewRef = useRef<HTMLVideoElement>(null)
  // Keep a ref to the active stream so switchCamera can stop it before requesting a new one
  const streamRef = useRef<MediaStream | null>(null)
  const [camReady, setCamReady] = useState(false)
  const [camError, setCamError] = useState(false)
  // 'user' = câmera frontal, 'environment' = câmera traseira
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [switching, setSwitching] = useState(false)

  useEffect(() => { setName(login) }, [login, setName])

  // Start preview with the current facingMode
  useEffect(() => {
    setCamReady(false)
    setCamError(false)

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode }, audio: false })
      .then((s) => {
        streamRef.current = s
        if (previewRef.current) {
          previewRef.current.srcObject = s
          setCamReady(true)
        }
      })
      .catch(() => setCamError(true))

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [facingMode]) // re-run whenever facingMode changes

  async function switchCamera() {
    if (switching) return
    setSwitching(true)
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))
    // switching flag is cleared when the new stream starts (setCamReady triggers re-render)
    setSwitching(false)
  }

  function goLive() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    navigate({ to: '/$login/live-broadcasting', params: { login } })
  }

  return (
    <div className="flex-1 flex flex-col relative bg-black lg:items-center lg:justify-center lg:p-8">

      {/* Camera preview — full screen on mobile */}
      <div className="relative flex-1 lg:flex-none lg:w-full lg:max-w-4xl lg:aspect-video lg:rounded-2xl overflow-hidden bg-zinc-900">
        <video
          ref={previewRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover ${camReady ? 'block' : 'hidden'}`}
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

        {/* Switch camera button — top right corner */}
        {camReady && (
          <button
            onClick={switchCamera}
            disabled={switching}
            className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white text-lg disabled:opacity-40 transition-opacity"
            title={facingMode === 'user' ? 'Switch to rear camera' : 'Switch to front camera'}
          >
            🔄
          </button>
        )}
      </div>

      {/* Go Live button — pinned to bottom */}
      <div className="w-full px-4 py-4 lg:max-w-4xl">
        <button
          onClick={goLive}
          className="w-full py-4 rounded-2xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold text-lg transition-colors flex items-center justify-center gap-3"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
          Go Live
        </button>
      </div>
    </div>
  )
}
