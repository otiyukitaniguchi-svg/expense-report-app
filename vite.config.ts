import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'node:fs'

const buildId = Date.now().toString()

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'build-id',
      transformIndexHtml(html) {
        return html.replace('</head>', `    <meta name="build-id" content="${buildId}" />\n  </head>`)
      },
      writeBundle() {
        writeFileSync('dist/version.json', JSON.stringify({ buildId }))
      }
    }
  ]
})
