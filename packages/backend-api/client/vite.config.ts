import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// import { resolve } from 'path'

// const VITE_ENV = process.env.ENV

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // publicDir: './public',
  // resolve: {
  //   alias: {
  //     '@': resolve(__dirname, 'src'),
  //   }
  // },
  // server: {
  //   proxy: VITE_ENV === 'development-mockapi' ? {} : {
  //     '/api': {
  //       target: 'http://localhost:8000',
  //       changeOrigin: true,
  //     }
  //   }
  // }
})
