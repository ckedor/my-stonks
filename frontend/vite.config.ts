import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

/* Só o app. As ferramentas de desenvolvimento — o catálogo do design system,
   o estúdio de temas e o painel de deploy, com o que elas gravam em arquivo e
   rodam no git — moram em `tools/`, com dev server próprio. */
export default defineConfig({
  plugins: [react()],
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
