import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const proxy = { '/api/pi': 'http://127.0.0.1:8787' }

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
  test: { environment: 'jsdom' },
})
