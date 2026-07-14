import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

/** dev-only: accepts the contact-sheet PNG from the client and overwrites
 * contact-sheet.png in the project root */
function sheetWriter(): Plugin {
  return {
    name: 'contact-sheet-writer',
    configureServer(server) {
      server.middlewares.use('/__sheet', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('POST only')
          return
        }
        const name = new URL(req.url ?? '/', 'http://x').searchParams.get('name') ?? ''
        if (!/^[a-z0-9-]{0,24}$/.test(name)) {
          res.statusCode = 400
          res.end('bad name')
          return
        }
        const file = name ? `contact-sheet-${name}.png` : 'contact-sheet.png'
        const chunks: Buffer[] = []
        req.on('data', (c) => chunks.push(c))
        req.on('end', () => {
          const dataUrl = Buffer.concat(chunks).toString('utf8')
          const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
          fs.writeFileSync(path.resolve(__dirname, file), Buffer.from(base64, 'base64'))
          res.end('ok')
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), sheetWriter()],
})
