import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import mkcert from 'vite-plugin-mkcert'

import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  server: {
    https: true,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  plugins: [
    mkcert(),
    tailwindcss(),
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
})
