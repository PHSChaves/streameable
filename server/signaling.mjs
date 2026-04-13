import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { randomUUID } from 'crypto'

// ─── State ───────────────────────────────────────────────────────────────────
let broadcasterWs = null
let broadcasterName = null
/** @type {Map<string, import('ws').WebSocket>} */
const viewers = new Map()

// ─── Helpers ─────────────────────────────────────────────────────────────────
function send(ws, data) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(data))
}

// ─── HTTP ─────────────────────────────────────────────────────────────────────
const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  if (req.url === '/api/broadcaster' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json')
    res.writeHead(200)
    res.end(JSON.stringify({ name: broadcasterName }))
    return
  }

  res.writeHead(404); res.end()
})

// ─── WebSocket signaling ──────────────────────────────────────────────────────
const wss = new WebSocketServer({ server })

wss.on('connection', (ws) => {
  let role = null
  let viewerId = null

  ws.on('message', (raw) => {
    let msg
    try { msg = JSON.parse(raw.toString()) } catch { return }

    switch (msg.type) {

      case 'register-broadcaster': {
        // If there is already a broadcaster that is NOT this socket, close the old one.
        // We must save a reference before overwriting broadcasterWs so the close
        // handler can detect it was replaced (and not null out the new connection).
        const prev = broadcasterWs
        if (prev && prev !== ws) prev.close()

        broadcasterWs = ws
        broadcasterName = msg.name ?? null
        role = 'broadcaster'
        send(ws, { type: 'registered-broadcaster', viewerCount: viewers.size })
        console.log(`[signal] broadcaster "${broadcasterName}" connected (${viewers.size} viewers waiting)`)

        // Tell the new broadcaster about every viewer that is already waiting
        viewers.forEach((_, vId) => {
          send(ws, { type: 'viewer-joined', viewerId: vId, viewerCount: viewers.size })
        })
        break
      }

      case 'register-viewer': {
        viewerId = randomUUID()
        viewers.set(viewerId, ws)
        role = 'viewer'
        send(ws, { type: 'registered-viewer', viewerId })

        if (broadcasterWs) {
          // Broadcaster is live — tell it about this new viewer
          send(broadcasterWs, { type: 'viewer-joined', viewerId, viewerCount: viewers.size })
        } else {
          // No broadcaster yet — viewer stays connected and waits
          send(ws, { type: 'no-broadcaster' })
        }
        console.log(`[signal] viewer joined (${viewers.size} total)`)
        break
      }

      // broadcaster → viewer: forward offer
      case 'offer': {
        const dest = viewers.get(msg.viewerId)
        send(dest, { type: 'offer', viewerId: msg.viewerId, sdp: msg.sdp })
        break
      }

      // viewer → broadcaster: forward answer
      case 'answer': {
        send(broadcasterWs, { type: 'answer', viewerId: msg.viewerId, sdp: msg.sdp })
        break
      }

      // ICE trickle: route by sender role
      case 'ice-candidate': {
        if (msg.from === 'broadcaster') {
          const dest = viewers.get(msg.viewerId)
          send(dest, { type: 'ice-candidate', from: 'broadcaster', viewerId: msg.viewerId, candidate: msg.candidate })
        } else {
          send(broadcasterWs, { type: 'ice-candidate', from: 'viewer', viewerId: msg.viewerId, candidate: msg.candidate })
        }
        break
      }
    }
  })

  ws.on('close', () => {
    if (role === 'broadcaster') {
      // KEY FIX: only clear the broadcaster slot if THIS socket is still the active one.
      // If a new broadcaster registered between our registration and this close event,
      // broadcasterWs will already point to the new socket — don't overwrite it.
      if (broadcasterWs === ws) {
        broadcasterWs = null
        broadcasterName = null
        viewers.forEach((v) => send(v, { type: 'broadcaster-disconnected' }))
        console.log('[signal] broadcaster disconnected')
      } else {
        console.log('[signal] old broadcaster socket closed (already replaced — ignoring)')
      }
    } else if (role === 'viewer' && viewerId) {
      viewers.delete(viewerId)
      if (broadcasterWs) {
        send(broadcasterWs, { type: 'viewer-left', viewerId, viewerCount: viewers.size })
      }
      console.log(`[signal] viewer left (${viewers.size} remaining)`)
    }
  })
})

const PORT = process.env.PORT ?? 8080
server.listen(PORT, () => {
  console.log(`Signaling server listening on http/ws://localhost:${PORT}`)
})
