import { defineConfig, ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

const VITE_ENV = process.env.ENV || 'development'

const proxyOptionsByEnv: Record<string, Record<string, ProxyOptions>> = {
  'development': {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    }
  },
  'production': {
    '/api': {
      target: 'https://cp.monitorss.xyz',
      changeOrigin: true,
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  publicDir: './public',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    }
  },
  server: {
    proxy: proxyOptionsByEnv[VITE_ENV] || {}
  },
  build: {
    sourcemap: true,
  }
})
