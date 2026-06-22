import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h1>personal health coach</h1>
      <p>Scoring engine + ingest pipeline. UI lands in Plan 2.</p>
    </main>
  </StrictMode>,
)
