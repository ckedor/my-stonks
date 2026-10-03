import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'path'
import { defineConfig, type Plugin } from 'vite'
import { applyPresetChange, PRESET_FILE_ENDPOINT, type PresetFileChange } from './src/theme/preset-file.ts'

/* O estúdio de temas salva os presets direto em `src/theme/presets.ts`.
   Só o dev server grava (`apply: 'serve'`), só esse arquivo, e só por meio de
   `applyPresetChange`, que recusa o que não reconhece. O Vite recarrega o
   módulo em seguida, e o estúdio já abre o preset salvo; o commit continua
   sendo o que publica o tema. */
function themePresetWriter(): Plugin {
  const file = path.resolve(__dirname, 'src/theme/presets.ts')
  return {
    name: 'theme-preset-writer',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(PRESET_FILE_ENDPOINT, (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', () => {
          try {
            const change = JSON.parse(body) as PresetFileChange
            fs.writeFileSync(file, applyPresetChange(fs.readFileSync(file, 'utf8'), change))
            res.statusCode = 204
            res.end()
          } catch (error) {
            res.statusCode = 400
            res.end(error instanceof Error ? error.message : String(error))
          }
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), themePresetWriter()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
    /* Sem isto o vitest varre `e2e/` também e tenta rodar os specs do
       Playwright dentro do jsdom, onde eles não fazem sentido. */
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
