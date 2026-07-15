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

/** dev-only: accepts edited layout JSON from the in-game editor and
 * overwrites src/game/layout.json (git-tracked, HMR-reloaded) */
function layoutWriter(): Plugin {
  return {
    name: 'layout-writer',
    configureServer(server) {
      server.middlewares.use('/__layout', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('POST only')
          return
        }
        const chunks: Buffer[] = []
        req.on('data', (c) => chunks.push(c))
        req.on('end', () => {
          try {
            const body = Buffer.concat(chunks).toString('utf8')
            JSON.parse(body) // validate before overwriting
            fs.writeFileSync(path.resolve(__dirname, 'src/game/layout.json'), body)
            res.end('ok')
          } catch {
            res.statusCode = 400
            res.end('invalid json')
          }
        })
      })
    },
  }
}

/** dev-only: accepts the edited node tree from the editor and overwrites
 * src/engine/scene.json (git-tracked, HMR-reloaded) */
function sceneWriter(): Plugin {
  return {
    name: 'scene-writer',
    configureServer(server) {
      server.middlewares.use('/__scene', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('POST only')
          return
        }
        const chunks: Buffer[] = []
        req.on('data', (c) => chunks.push(c))
        req.on('end', () => {
          try {
            const body = Buffer.concat(chunks).toString('utf8')
            const parsed = JSON.parse(body)
            if (!Array.isArray(parsed.nodes)) throw new Error('no nodes')
            fs.writeFileSync(path.resolve(__dirname, 'src/engine/scene.json'), body)
            res.end('ok')
          } catch {
            res.statusCode = 400
            res.end('invalid scene json')
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), sheetWriter(), layoutWriter(), sceneWriter()],
  build: {
    rollupOptions: {
      input: {
        game: path.resolve(__dirname, 'index.html'),
        notFound: path.resolve(__dirname, '404.html'),
        // The production editor exists for explicit ?editor share links; it
        // is not linked or rendered without that query gate.
        editor: path.resolve(__dirname, 'editor.html'),
      },
    },
  },
})
