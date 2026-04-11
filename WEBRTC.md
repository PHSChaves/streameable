# WebRTC — O que você precisa saber

> Documentação focada nos conceitos mais importantes do WebRTC e em como eles são aplicados neste projeto LiveCam.

---

## O que é WebRTC?

**WebRTC** (Web Real-Time Communication) é uma API nativa dos navegadores que permite transmitir áudio, vídeo e dados diretamente entre dois navegadores — sem precisar de um servidor intermediário para carregar a mídia.

O fluxo de vídeo vai de **peer a peer**: o servidor só é necessário para apresentar os dois lados. Depois disso, a mídia trafega diretamente.

---

## Os 3 pilares do WebRTC

### 1. `getUserMedia` — Captura de mídia

```ts
const stream = await navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true,
})
```

Pede permissão ao navegador para acessar câmera e microfone. Retorna um `MediaStream`, que é um objeto contendo uma ou mais **tracks** (faixas):

- `stream.getVideoTracks()` → faixas de vídeo
- `stream.getAudioTracks()` → faixas de áudio

**No projeto:** chamado em `useBroadcaster.ts` quando o broadcaster clica em "Go Live". O stream retornado é exibido no `<video>` local e adicionado à conexão WebRTC.

---

### 2. `RTCPeerConnection` — A conexão peer-to-peer

É o coração do WebRTC. Representa a conexão entre dois peers (broadcaster ↔ viewer). Ela cuida de:

- Negociar os formatos de mídia suportados (codecs)
- Estabelecer o caminho de rede (via ICE)
- Criptografar tudo (DTLS/SRTP obrigatório)
- Transmitir as tracks de mídia

```ts
const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
```

**No projeto:** o broadcaster cria **uma `RTCPeerConnection` por viewer**. Isso é necessário porque WebRTC é P2P — cada par de conexão é independente.

```ts
// useBroadcaster.ts — um Map de conexões, uma por viewer
const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map())
```

---

### 3. Signaling — A "apresentação" entre os peers

WebRTC não sabe como encontrar o outro peer por conta própria. Você precisa de um **servidor de sinalização** para trocar as informações de conexão. O servidor de sinalização **não transporta mídia** — só troca mensagens de controle.

As mensagens trocadas são:

| Mensagem | O que é |
|---|---|
| **Offer (SDP)** | O broadcaster diz "aqui está o que eu suporto e quero enviar" |
| **Answer (SDP)** | O viewer responde "aceito, aqui está o que eu suporto" |
| **ICE Candidate** | Cada lado informa possíveis caminhos de rede para a conexão |

**No projeto:** o servidor de sinalização está em `server/signaling.mjs`, usando WebSocket. Ele apenas **roteia mensagens** — nunca toca no vídeo.

---

## SDP — Session Description Protocol

O **SDP** é um texto estruturado que descreve uma sessão de mídia. Ele contém:

- Quais codecs de vídeo/áudio são suportados (H.264, VP8, Opus...)
- Resolução, bitrate, direção do fluxo (`sendonly`, `recvonly`, `sendrecv`)
- Informações de segurança (chaves DTLS)

O processo de negociação via SDP é chamado de **Offer/Answer**:

```
Broadcaster                    Viewer
    |                             |
    |── createOffer() ──────────► |  (broadcaster gera o offer)
    |── setLocalDescription() ──► |  (broadcaster salva localmente)
    |                             |
    |   [sinalização via WS]      |
    |                             |
    |◄── setRemoteDescription() ──|  (viewer recebe o offer)
    |◄── createAnswer() ──────────|  (viewer gera a resposta)
    |◄── setLocalDescription() ───|  (viewer salva localmente)
    |                             |
    |   [sinalização via WS]      |
    |                             |
    |── setRemoteDescription() ──►|  (broadcaster recebe o answer)
    |                             |
    |   conexão estabelecida ✓    |
```

**No projeto** (`useBroadcaster.ts`):

```ts
const offer = await pc.createOffer()
await pc.setLocalDescription(offer)
ws.send(JSON.stringify({ type: 'offer', viewerId: msg.viewerId, sdp: offer }))
```

**No projeto** (`useViewer.ts`):

```ts
await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
const answer = await pc.createAnswer()
await pc.setLocalDescription(answer)
ws.send(JSON.stringify({ type: 'answer', viewerId: msg.viewerId, sdp: answer }))
```

---

## ICE — Interactive Connectivity Establishment

**ICE** é o mecanismo que o WebRTC usa para descobrir o melhor caminho de rede entre os dois peers. Ele testa várias rotas e escolhe a melhor.

### Tipos de ICE Candidates

| Tipo | O que é |
|---|---|
| **host** | IP local da máquina (ex: `192.168.1.5`) |
| **srflx** (server reflexive) | IP público descoberto via servidor STUN |
| **relay** | IP de um servidor TURN (fallback quando P2P falha) |

### STUN — Session Traversal Utilities for NAT

Servidor público que responde: *"seu IP público é X, sua porta é Y"*. Permite que dois peers atrás de NATs se encontrem.

```ts
// Usado no projeto
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]
```

### TURN — Traversal Using Relays around NAT

Quando a conexão direta falha (firewalls corporativos, NAT simétrico), o TURN funciona como um relay: o vídeo passa pelo servidor. É o fallback. **Não foi configurado neste projeto** — em produção, você precisaria de um servidor TURN próprio (ex: coturn).

### ICE Trickle

Em vez de esperar coletar todos os candidates antes de enviar, o **trickle ICE** envia cada candidate assim que é descoberto. Isso acelera o estabelecimento da conexão.

```ts
// useBroadcaster.ts — enviando cada candidate assim que chega
pc.onicecandidate = (e) => {
  if (e.candidate) {
    ws.send(JSON.stringify({
      type: 'ice-candidate',
      from: 'broadcaster',
      viewerId,
      candidate: e.candidate,
    }))
  }
}
```

---

## MediaStream e Tracks

Um `MediaStream` é um container de **tracks**. Cada track é uma faixa independente de mídia:

```
MediaStream
├── VideoTrack  (câmera)
└── AudioTrack  (microfone)
```

Para adicionar o stream à conexão WebRTC:

```ts
// useBroadcaster.ts
stream.getTracks().forEach((track) => pc.addTrack(track, stream))
```

### Mutar e desligar câmera sem quebrar a conexão

A forma correta de mutar/desligar câmera é desabilitar a track — **não** chamar `.stop()`, que encerraria a track e quebraria a negociação WebRTC.

```ts
// Mudo: desabilita o áudio sem parar a conexão
track.enabled = false  // viewer continua conectado, mas não ouve nada

// Câmera off: desabilita o vídeo
track.enabled = false  // viewer continua conectado, mas recebe frame preto
```

**No projeto** (`useBroadcaster.ts`):

```ts
const toggleMute = useCallback(() => {
  const track = streamRef.current?.getAudioTracks()[0]
  if (!track) return
  track.enabled = !track.enabled  // só liga/desliga — não reconecta
  setMuted(!track.enabled)
}, [])
```

---

## Como o projeto está estruturado

```
Broadcaster (browser A)              Signaling Server (Node.js)          Viewer (browser B)
        |                                      |                                |
        |── WS: register-broadcaster ─────────►|                                |
        |◄── registered-broadcaster ───────────|                                |
        |                                      |◄── register-viewer ────────────|
        |                                      |──► registered-viewer ──────────►|
        |◄── viewer-joined ────────────────────|                                |
        |                                      |                                |
        |   (cria RTCPeerConnection)           |                                |
        |── WS: offer (SDP) ──────────────────►|── offer (SDP) ────────────────►|
        |                                      |                                | (cria RTCPeerConnection)
        |◄── WS: answer (SDP) ─────────────────|◄── answer (SDP) ───────────────|
        |                                      |                                |
        |◄──► WS: ice-candidates ─────────────►|◄──► ice-candidates ────────────|
        |                                      |                                |
        └──────────── vídeo/áudio P2P direto ──────────────────────────────────►┘
                         (sem passar pelo servidor)
```

### Arquivos do projeto

| Arquivo | Responsabilidade |
|---|---|
| `server/signaling.mjs` | WebSocket server — só roteia SDP e ICE, nunca toca no vídeo |
| `src/hooks/useBroadcaster.ts` | `getUserMedia` + `RTCPeerConnection` por viewer + controles de track |
| `src/hooks/useViewer.ts` | `RTCPeerConnection` como receiver + renderiza stream remoto |
| `src/pages/LiveBroadcasting.tsx` | UI do broadcaster com `<video muted>` para preview local |
| `src/pages/LiveViewer.tsx` | UI do viewer com `<video>` para stream recebido |

---

## Por que o `<video>` do broadcaster tem `muted`?

```tsx
<video ref={videoRef} autoPlay playsInline muted />
```

O atributo `muted` no HTML impede que o navegador reproduza o áudio da **própria câmera** localmente. Sem ele, o broadcaster ouviria a própria voz com delay — um eco. O áudio ainda é **enviado** para os viewers normalmente; o `muted` só afeta a reprodução local.

---

## Limitações desta implementação

| Limitação | Explicação |
|---|---|
| Sem servidor TURN | Em redes com NAT simétrico ou firewall restritivo, a conexão P2P pode falhar |
| 1 broadcaster por vez | O servidor de sinalização só mantém uma referência de broadcaster |
| Sem reconexão automática | Se a conexão cair, o viewer precisa recarregar |
| Mesh topology | Cada viewer cria uma conexão com o broadcaster — com muitos viewers, o broadcaster precisa encodar e enviar N streams. Para escala real, usaria SFU (ex: mediasoup, LiveKit) |

---

## Glossário rápido

| Termo | Significado |
|---|---|
| **SDP** | Descrição da sessão (codecs, formatos, segurança) |
| **ICE** | Algoritmo para encontrar o melhor caminho de rede |
| **STUN** | Servidor que revela seu IP público |
| **TURN** | Servidor relay quando P2P falha |
| **Offer/Answer** | Processo de negociação de mídia entre os peers |
| **Track** | Faixa individual de mídia (vídeo ou áudio) |
| **MediaStream** | Container de tracks |
| **Trickle ICE** | Envio incremental de candidates para conexão mais rápida |
| **DTLS/SRTP** | Protocolos de criptografia obrigatórios no WebRTC |
| **SFU** | Selective Forwarding Unit — servidor que recebe um stream e reenvia para N viewers (para produção em escala) |
