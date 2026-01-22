import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import htmlMinifier from 'vite-plugin-html-minifier'
import mkcert from 'vite-plugin-mkcert'

import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    https: {},
    proxy: {
      '/api/transfers': {
        target: 'http://143.198.220.234:9800',
        changeOrigin: true,
        rewrite: (path: string) => {
          return path.replace(/^\/api/, '')
        },
      },

      '/api0/sign': {
        // target: 'http://143.198.220.234:60002', // 线上
        target: 'http://143.198.220.234:50002', // 本地测试
        changeOrigin: true,
        rewrite: (path: string) => {
          return path.replace(/^\/api0/, '')
        },
      },
      '/api1/sign': {
        // target: 'http://143.198.220.234:60003', // 线上
        target: 'http://143.198.220.234:50003', // 本地测试
        changeOrigin: true,
        rewrite: (path: string) => {
          return path.replace(/^\/api1/, '')
        },
      },
      '/api2/sign': {
        // target: 'http://143.198.220.234:60004', // 线上
        target: 'http://143.198.220.234:50004', // 本地测试
        changeOrigin: true,
        rewrite: (path: string) => {
          return path.replace(/^\/api2/, '')
        },
      },

      '/api': {
        target: 'http://143.198.220.234:60002',
        changeOrigin: true,
        rewrite: (path: string) => {
          console.log(333333, path.replace(/^\/api/, ''))
          return path.replace(/^\/api/, '')
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  plugins: [
    mkcert(),
    tailwindcss(),
    htmlMinifier({
      minify: true,
    }),
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  esbuild: mode === 'production' ? ({ drop: ['console'] } as any) : undefined,
}))
