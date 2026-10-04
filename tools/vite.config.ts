import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'
import { applyCatalogChange, CATALOG_FILE_ENDPOINT } from './server/catalog-file'
import { deployRunner } from './server/deploy-runner'
import { themePresetWriter } from './server/preset-writer'
import { sourceFileWriter } from './server/source-writer'

/* As ferramentas de desenvolvimento: fora do app, num dev server próprio.
   Importam o app pelo mesmo `@/` que ele usa; o app nunca importa daqui. */
const repo = path.resolve(__dirname, '..')

export default defineConfig({
  root: __dirname,
  plugins: [
    react(),
    themePresetWriter(path.join(repo, 'frontend/src/theme/presets.ts')),
    sourceFileWriter(
      'city-catalog-writer',
      CATALOG_FILE_ENDPOINT,
      path.join(repo, 'frontend/src/components/city-game/catalog.ts'),
      applyCatalogChange,
    ),
    deployRunner(repo),
  ],
  resolve: { alias: { '@': path.join(repo, 'frontend/src') } },
  // O app mora fora da raiz deste servidor.
  server: { port: 5180, strictPort: true, fs: { allow: [repo] } },
})
