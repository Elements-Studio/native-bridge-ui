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
          console.log(111111111, path)
          return path.replace(/^\/api/, '')
        },
      },
      '/api/sign': {
        target: 'http://143.198.220.234:9800',
        changeOrigin: true,
        rewrite: (path: string) => {
          console.log(222222222, path)
          return path.replace(/^\/api/, '')
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
