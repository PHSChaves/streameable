import { useEffect, useRef, useState } from 'react'

const SIGNALING_URL = (import.meta.env.VITE_SIGNAL_WS as string | undefined) ?? 'ws://localhost:8080'
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

export type ViewerStatus = 'connecting' | 'waiting' | 'watching' | 'no-stream' | 'error'

export function useViewer() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<ViewerStatus>('connecting')
  const [forceMuted, setForceMuted] = useState(false)

  useEffect(() => {
    let ws: WebSocket
    let pc: RTCPeerConnection
    let viewerId: string | null = null
    let cancelled = false

    // ICE candidate buffer — candidates can arrive before setRemoteDescription
    // completes because ws.onmessage is async and the event loop can interleave.
    let remoteDescSet = false
    const pendingCandidates: RTCIceCandidateInit[] = []

    async function addCandidate(candidate: RTCIceCandidateInit) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      } catch (err) {
        console.warn('[viewer] addIceCandidate failed:', err)
      }
    }

    function connect() {
      ws = new WebSocket(SIGNALING_URL)
      pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

      // ── Track received: wire it to the video element ─────────────
      pc.ontrack = (e) => {
        if (cancelled) return
        console.log('[viewer] ontrack', e.track.kind, 'streams:', e.streams.length)

        const stream = e.streams[0] ?? new MediaStream([e.track])

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          // Explicit play() handles browsers that block autoplay on unmuted media
          videoRef.current.play().catch((err) => {
            console.warn('[viewer] autoplay blocked, retrying muted:', err)
            if (videoRef.current) {
              videoRef.current.muted = true
              setForceMuted(true)
              videoRef.current.play().catch(console.error)
            }
          })
          setStatus('watching')
        }
      }

      // ── Send our ICE candidates to the signaling server ───────────
      pc.onicecandidate = (e) => {
        if (e.candidate && viewerId) {
          ws.send(JSON.stringify({
            type: 'ice-candidate',
            from: 'viewer',
            viewerId,
            candidate: e.candidate,
          }))
        }
      }

      pc.onconnectionstatechange = () => {
        console.log('[viewer] connectionState:', pc.connectionState)
        if (pc.connectionState === 'failed') setStatus('error')
      }

      pc.oniceconnectionstatechange = () => {
        console.log('[viewer] iceConnectionState:', pc.iceConnectionState)
      }

      // ── WebSocket messages ────────────────────────────────────────
      ws.onopen = () => {
        console.log('[viewer] WS connected, registering…')
        ws.send(JSON.stringify({ type: 'register-viewer' }))
      }

      ws.onmessage = async (e) => {
        if (cancelled) return
        let msg: Record<string, unknown>
        try { msg = JSON.parse(e.data) } catch { return }
        console.log('[viewer] msg:', msg.type)

        if (msg.type === 'registered-viewer') {
          viewerId = msg.viewerId as string
          setStatus('waiting')
        }

        if (msg.type === 'no-broadcaster') {
          // Stay in 'waiting' — the broadcaster may arrive later.
          // The signaling server will send a viewer-joined to the broadcaster
          // (and an offer back to us) as soon as someone goes live.
          setStatus('waiting')
        }

        if (msg.type === 'offer') {
          try {
            const sdp = msg.sdp as RTCSessionDescriptionInit
            await pc.setRemoteDescription(new RTCSessionDescription(sdp))
            remoteDescSet = true

            // Drain any candidates that arrived before the remote desc was ready
            for (const c of pendingCandidates.splice(0)) await addCandidate(c)

            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            ws.send(JSON.stringify({ type: 'answer', viewerId: msg.viewerId, sdp: answer }))
            console.log('[viewer] answer sent')
          } catch (err) {
            console.error('[viewer] offer handling failed:', err)
          }
        }

        if (msg.type === 'ice-candidate' && msg.from === 'broadcaster' && msg.candidate) {
          const candidate = msg.candidate as RTCIceCandidateInit
          if (remoteDescSet) {
            await addCandidate(candidate)
          } else {
            // Buffer until after setRemoteDescription
            pendingCandidates.push(candidate)
          }
        }

        if (msg.type === 'broadcaster-disconnected') {
          if (videoRef.current) videoRef.current.srcObject = null
          setStatus('no-stream')
        }
      }

      ws.onerror = (err) => {
        console.error('[viewer] WS error:', err)
        if (!cancelled) setStatus('error')
      }
      ws.onclose = () => {
        console.log('[viewer] WS closed')
        if (!cancelled) setStatus((s) => (s === 'watching' ? 'no-stream' : s))
      }
    }

    connect()

    return () => {
      cancelled = true
      ws?.close()
      pc?.close()
    }
  }, [])

  function unmute() {
    if (!videoRef.current) return
    videoRef.current.muted = false
    videoRef.current.play().catch(console.error)
    setForceMuted(false)
  }

  return { videoRef, status, forceMuted, unmute }
}
