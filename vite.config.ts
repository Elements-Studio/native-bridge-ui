import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import htmlMinifier from 'vite-plugin-html-minifier'
import mkcert from 'vite-plugin-mkcert'

import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  server: {
    https: {},
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
})
