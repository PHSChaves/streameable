import { useEffect, useRef, useState, useCallback } from 'react'

const SIGNALING_URL = 'ws://localhost:8080'
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

export type BroadcasterStatus = 'idle' | 'requesting' | 'live' | 'error'

export function useBroadcaster(login: string) {
  const name = login
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<BroadcasterStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [viewerCount, setViewerCount] = useState(0)
  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)

  const streamRef = useRef<MediaStream | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map())

  // Per-peer ICE candidate buffers
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
  const remoteDescSetRef = useRef<Set<string>>(new Set())

  // Cancellation token — lets stopStream() abort a mid-flight startStream()
  const cancelTokenRef = useRef<{ cancelled: boolean }>({ cancelled: false })

  function createPeer(viewerId: string, ws: WebSocket, stream: MediaStream): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    stream.getTracks().forEach((track) => pc.addTrack(track, stream))

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        ws.send(JSON.stringify({ type: 'ice-candidate', from: 'broadcaster', viewerId, candidate: e.candidate }))
      }
    }

    pc.onconnectionstatechange = () => {
      console.log(`[broadcaster] peer ${viewerId.slice(0, 8)} → ${pc.connectionState}`)
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        peersRef.current.delete(viewerId)
        pendingCandidatesRef.current.delete(viewerId)
        remoteDescSetRef.current.delete(viewerId)
      }
    }

    return pc
  }

  const startStream = useCallback(async () => {
    // Guard: already streaming
    if (streamRef.current) return

    // Create a fresh cancellation token for this start attempt
    const token = { cancelled: false }
    cancelTokenRef.current = token

    setStatus('requesting')
    setError(null)

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    } catch (err) {
      if (token.cancelled) return  // cleanup ran before getUserMedia resolved
      setError(err instanceof Error ? err.message : 'Camera/mic access denied.')
      setStatus('error')
      return
    }

    // If stopStream() was called while we were waiting for camera permission, bail out
    if (token.cancelled) {
      stream.getTracks().forEach((t) => t.stop())
      return
    }

    streamRef.current = stream
    if (videoRef.current) videoRef.current.srcObject = stream

    const ws = new WebSocket(SIGNALING_URL)
    wsRef.current = ws

    ws.onopen = () => {
      if (token.cancelled) { ws.close(); return }
      console.log('[broadcaster] WS connected, registering as:', name)
      ws.send(JSON.stringify({ type: 'register-broadcaster', name }))
    }

    ws.onmessage = async (e) => {
      if (token.cancelled) return
      let msg: Record<string, unknown>
      try { msg = JSON.parse(e.data) } catch { return }
      console.log('[broadcaster] ←', msg.type)

      if (msg.type === 'registered-broadcaster') {
        setStatus('live')
        setViewerCount(msg.viewerCount as number)
      }

      if (msg.type === 'viewer-joined') {
        const viewerId = msg.viewerId as string
        setViewerCount(msg.viewerCount as number)

        // If we already have a peer for this viewer (e.g. re-joined), clean it up first
        const existing = peersRef.current.get(viewerId)
        if (existing) { existing.close(); peersRef.current.delete(viewerId) }

        try {
          const pc = createPeer(viewerId, ws, stream)
          peersRef.current.set(viewerId, pc)
          pendingCandidatesRef.current.set(viewerId, [])

          const offer = await pc.createOffer()
          if (token.cancelled) return
          await pc.setLocalDescription(offer)
          ws.send(JSON.stringify({ type: 'offer', viewerId, sdp: offer }))
          console.log('[broadcaster] offer → viewer', viewerId.slice(0, 8))
        } catch (err) {
          console.error('[broadcaster] offer creation failed:', err)
        }
      }

      if (msg.type === 'viewer-left') {
        const viewerId = msg.viewerId as string
        setViewerCount(msg.viewerCount as number)
        const pc = peersRef.current.get(viewerId)
        if (pc) { pc.close(); peersRef.current.delete(viewerId) }
        pendingCandidatesRef.current.delete(viewerId)
        remoteDescSetRef.current.delete(viewerId)
      }

      if (msg.type === 'answer') {
        const viewerId = msg.viewerId as string
        const pc = peersRef.current.get(viewerId)
        if (!pc) return
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp as RTCSessionDescriptionInit))
          remoteDescSetRef.current.add(viewerId)
          console.log('[broadcaster] remote desc set for', viewerId.slice(0, 8))

          // Drain buffered candidates that arrived before the answer
          const pending = pendingCandidatesRef.current.get(viewerId) ?? []
          for (const c of pending.splice(0)) {
            await pc.addIceCandidate(new RTCIceCandidate(c)).catch(console.warn)
          }
        } catch (err) {
          console.error('[broadcaster] setRemoteDescription failed:', err)
        }
      }

      if (msg.type === 'ice-candidate' && msg.from === 'viewer') {
        const viewerId = msg.viewerId as string
        const pc = peersRef.current.get(viewerId)
        if (!pc || !msg.candidate) return

        if (remoteDescSetRef.current.has(viewerId)) {
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate as RTCIceCandidateInit)).catch(console.warn)
        } else {
          const buf = pendingCandidatesRef.current.get(viewerId)
          if (buf) buf.push(msg.candidate as RTCIceCandidateInit)
        }
      }
    }

    ws.onerror = (err) => {
      console.error('[broadcaster] WS error:', err)
      if (!token.cancelled) {
        setError('Cannot connect to signaling server — is it running?')
        setStatus('error')
      }
    }

    ws.onclose = () => {
      console.log('[broadcaster] WS closed')
      if (!token.cancelled) setStatus((s) => (s === 'live' ? 'idle' : s))
    }
  }, [login])

  const stopStream = useCallback(() => {
    // Cancel any in-flight startStream
    cancelTokenRef.current.cancelled = true

    streamRef.current?.getTracks().forEach((t) => t.stop())
    wsRef.current?.close()
    peersRef.current.forEach((pc) => pc.close())
    peersRef.current.clear()
    pendingCandidatesRef.current.clear()
    remoteDescSetRef.current.clear()
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setStatus('idle')
    setViewerCount(0)
    setMuted(false)
    setCamOff(false)
  }, [])

  const toggleMute = useCallback(() => {
    const track = streamRef.current?.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setMuted(!track.enabled)
  }, [])

  const toggleCam = useCallback(() => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setCamOff(!track.enabled)
  }, [])

  useEffect(() => () => stopStream(), [stopStream])

  return { videoRef, status, error, viewerCount, muted, camOff, startStream, stopStream, toggleMute, toggleCam }
}
