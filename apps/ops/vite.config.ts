import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const controlApiTarget =
  process.env.CHIBA3_CONTROL_API_PROXY_TARGET ?? 'http://127.0.0.1:8795'
const allowedHosts = ['chiba.mars.college', 'cable.mars.college']

const proxy = {
  '/api/ops': {
    target: controlApiTarget,
  },
  '/api': {
    target: controlApiTarget,
  },
} as const

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts,
    port: 8792,
    strictPort: true,
    proxy,
  },
  preview: {
    allowedHosts,
    port: 8792,
    strictPort: true,
    proxy,
  },
})
