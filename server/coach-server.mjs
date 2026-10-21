// Coach server: the HTTP endpoint src/coach/httpAdapter.ts talks to.
// Accepts POST /coach { context, question } (computed numbers and labels only)
// and answers { reply } using an NVIDIA NIM chat model. The API key lives here,
// in server/.env, and is never sent to or read from the browser.
// Run: npm run coach:server   (loads server/.env via node --env-file)
import http from 'node:http'

const PORT = Number(process.env.PORT ?? 8787)
const API_KEY = process.env.NVIDIA_API_KEY
const MODEL = process.env.NVIDIA_MODEL ?? 'deepseek-ai/deepseek-v4.1-flash'
const NIM_URL = process.env.NVIDIA_BASE_URL ?? 'https://integrate.api.nvidia.com/v1/chat/completions'
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ??
  'http://localhost:5173,http://localhost:5180,https://shreyask06.github.io'
).split(',')
const MAX_BODY_BYTES = 20_000
const MAX_QUESTION_CHARS = 500
const RATE_LIMIT_PER_MIN = 30
const UPSTREAM_TIMEOUT_MS = 20_000

if (!API_KEY) {
  console.error('NVIDIA_API_KEY is not set. Copy server/.env.example to server/.env and fill it in.')
  process.exit(1)
}

const SYSTEM_PROMPT =
  'You are a concise personal health and training coach. You are given the user\'s ' +
  'already-computed metrics (recovery, HRV, resting heart rate, sleep, sleep debt, readiness, ' +
  'suggested intensity zone, acute:chronic load ratio, monotony). Use only those numbers and ' +
  'never invent values. Reply in 2 to 4 short sentences of plain text, with no markdown. ' +
  'Be practical about training intensity, sleep and recovery. If load is flagged caution or ' +
  'high-risk, or readiness is Strained or Run down, do not recommend hard training. ' +
  'You are not a doctor: for pain, illness or unusual symptoms, suggest seeing a professional.'

const hits = new Map() // ip -> timestamps (ms) within the last minute

function rateLimited(ip) {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000)
  recent.push(now)
  hits.set(ip, recent)
  return recent.length > RATE_LIMIT_PER_MIN
}

function send(res, status, body, origin) {
  const headers = { 'Content-Type': 'application/json' }
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Headers'] = 'Content-Type'
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    headers.Vary = 'Origin'
  }
  res.writeHead(status, headers)
  res.end(JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

// Keep only plain numbers, short strings and null so a stray field cannot smuggle text into the prompt.
function sanitizeContext(raw) {
  const out = {}
  for (const [k, v] of Object.entries(raw ?? {})) {
    if (v === null || typeof v === 'number' || typeof v === 'boolean') out[k] = v
    else if (typeof v === 'string') out[k] = v.slice(0, 200)
  }
  return out
}

async function askModel(context, question) {
  const userMessage = question
    ? `Metrics: ${JSON.stringify(context)}\n\nQuestion: ${question}`
    : `Metrics: ${JSON.stringify(context)}\n\nGive a short morning brief: how recovered am I and how hard should I train today?`
  const upstream = await fetch(NIM_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 300,
      temperature: 0.4,
      stream: false,
    }),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  })
  if (!upstream.ok) throw new Error(`upstream HTTP ${upstream.status}`)
  const data = await upstream.json()
  const reply = data?.choices?.[0]?.message?.content
  if (typeof reply !== 'string' || reply.trim() === '') throw new Error('empty upstream reply')
  return reply.trim()
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin
  const url = new URL(req.url ?? '/', 'http://localhost')

  if (req.method === 'OPTIONS') return send(res, 204, {}, origin)
  if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true, model: MODEL }, origin)
  if (req.method !== 'POST' || url.pathname !== '/coach') return send(res, 404, { error: 'not found' }, origin)
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return send(res, 403, { error: 'origin not allowed' }, origin)
  if (rateLimited(req.socket.remoteAddress ?? 'unknown')) return send(res, 429, { error: 'too many requests' }, origin)

  try {
    const body = JSON.parse(await readBody(req))
    const question = typeof body.question === 'string' ? body.question.trim().slice(0, MAX_QUESTION_CHARS) : ''
    if (typeof body.context !== 'object' || body.context === null) return send(res, 400, { error: 'context required' }, origin)
    const reply = await askModel(sanitizeContext(body.context), question)
    send(res, 200, { reply }, origin)
  } catch (err) {
    // Log the reason only: never the request body, the key, or upstream payloads.
    console.warn('[coach-server] request failed:', err instanceof Error ? err.message : 'unknown error')
    send(res, 502, { error: 'coach unavailable' }, origin)
  }
})

server.listen(PORT, '127.0.0.1', () => console.log(`Coach server on http://localhost:${PORT} (model ${MODEL})`))
