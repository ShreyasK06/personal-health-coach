import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => ({
  // Production build is served from https://<user>.github.io/personal-health-coach/
  // on GitHub Pages; local dev stays at the root so localhost:5173 works.
  base: command === 'build' ? '/personal-health-coach/' : '/',
  plugins: [react(), tailwindcss()],
}))
