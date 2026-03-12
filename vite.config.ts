import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import htmlMinifier from 'vite-plugin-html-minifier'

import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isLocalDebug = env.VITE_BRIDGE_LOCAL_DEBUG === 'true'

  // Local debug targets (127.0.0.1 services)
  const localTargets = {
    transfers: 'http://127.0.0.1:3001',
    estimateFees: 'http://127.0.0.1:50002',
    sign0: 'http://127.0.0.1:50002',
    sign1: 'http://127.0.0.1:50003',
    sign2: 'http://127.0.0.1:50004',
  }

  // Remote targets (starswap.xyz services)
  const remoteTargets = {
    transfers: 'http://143.198.220.234:9800',
    estimateFees: 'http://143.198.220.234:50004',
    sign0: 'http://143.198.220.234:50002',
    sign1: 'http://143.198.220.234:50003',
    sign2: 'http://143.198.220.234:50004',
  }

  const targets = isLocalDebug ? localTargets : remoteTargets

  return {
    server: {
      // Disable HTTPS for local development (mkcert requires interactive auth)
      proxy: {
        '/api/transfers': {
          target: targets.transfers,
          changeOrigin: true,
          rewrite: (path: string) => {
            return path.replace(/^\/api/, '')
          },
        },

        '/api0/sign': {
          target: targets.sign0,
          changeOrigin: true,
          rewrite: (path: string) => {
            return path.replace(/^\/api0/, '')
          },
        },
        '/api1/sign': {
          target: targets.sign1,
          changeOrigin: true,
          rewrite: (path: string) => {
            return path.replace(/^\/api1/, '')
          },
        },
        '/api2/sign': {
          target: targets.sign2,
          changeOrigin: true,
          rewrite: (path: string) => {
            return path.replace(/^\/api2/, '')
          },
        },

        '/api/estimate_fees': {
          target: targets.estimateFees,
          changeOrigin: true,
          rewrite: (path: string) => {
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
      // // // // // // // mkcert(), // Disabled for local dev // Disabled for local dev // Disabled for local dev // Disabled for local dev // Disabled for local dev // Disabled for local dev // Disabled for local dev without HTTPS
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
    build:
      mode === 'production'
        ? {
            minify: 'terser',
            terserOptions: {
              compress: {
                drop_debugger: true,
                pure_funcs: ['console.log', 'alert'],
              },
            },
          }
        : undefined,
  }
})
