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

  useEffect(() => { setName(login) }, [login, setName])
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
    <div className="flex-1 flex flex-col relative bg-black lg:items-center lg:justify-center lg:p-8">
      <div className='!p-2 w-full absolute top-0 z-10'>
        <span>TESTE</span>
      </div>
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
      </div>
      <div className='!p-2 w-full absolute bottom-0'>
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
