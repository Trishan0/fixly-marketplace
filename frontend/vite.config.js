import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { seoPlugin } from './seo.plugin.js'

export default defineConfig(({ mode }) => ({
  plugins: [react(), seoPlugin(loadEnv(mode, process.cwd(), ''))],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
  allowedHosts: ['.ngrok-free.app'],

    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
  },
}))
