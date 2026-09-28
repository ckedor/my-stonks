// Grava a folha de estudo de uma peça do jogo em PNG: a referência, a peça
// com régua em metros e as outras três vistas. Quem modela — gente ou agente —
// olha a folha e corrige a receita. Não é teste: não compara pixel com nada,
// então a build do Chromium não importa aqui (ao contrário do `npm run e2e`).
//
//   node scripts/iso-render.mjs <receita | id de prédio de ativo> [--ref foto.png] [--band top|mid|base]
//                                          [--rotation 0-3] [--out arquivo.png]
//
// Sobe um vite próprio, com cache separado, para não disputar o do dev server.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const repo = path.dirname(root)

const args = process.argv.slice(2)
const flag = name => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? undefined : args.splice(i, 2)[1]
}
const ref = flag('ref')
const band = flag('band')
const rotation = Number(flag('rotation') ?? 0)
const outFlag = flag('out')
const [recipe] = args
if (!recipe) {
  console.error('uso: node scripts/iso-render.mjs <receita> [--ref foto.png] [--band top|mid|base] [--rotation 0-3] [--out arquivo.png]')
  process.exit(2)
}
if (band && !['top', 'mid', 'base'].includes(band)) throw new Error(`--band deve ser top, mid ou base, não ${band}`)

const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }
const reference = ref
  ? `data:${mime[path.extname(ref).toLowerCase()] ?? 'image/png'};base64,${(await readFile(path.resolve(ref))).toString('base64')}`
  : undefined
const out = path.resolve(outFlag ?? path.join(repo, 'output', 'iso-render', `${recipe.replaceAll(':', '-')}${band ? `-${band}` : ''}.png`))

const server = await createServer({
  root,
  configFile: path.join(root, 'vite.config.ts'),
  cacheDir: path.join(root, 'node_modules', '.vite-iso-render'),
  server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false },
  logLevel: 'error',
})
await server.listen()
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  page.on('pageerror', error => console.error(error.message))
  const url = new URL('scripts/iso-render.html', server.resolvedUrls.local[0]).href
  // Na primeira vez o vite otimiza dependências e recarrega a página no meio:
  // tenta de novo até ela ficar de pé.
  let result
  for (let attempt = 0; !result; attempt++) {
    try {
      await page.goto(url)
      await page.waitForFunction(() => typeof window.isoRender === 'function', null, { timeout: 60_000 })
      result = await page.evaluate(options => window.isoRender(options), { recipe, reference, band, rotation })
    } catch (error) {
      if (attempt >= 2 || !/context was destroyed|navigation|Target closed/i.test(String(error))) throw error
    }
  }
  await mkdir(path.dirname(out), { recursive: true })
  await writeFile(out, Buffer.from(result.dataUrl.split(',')[1], 'base64'))
  console.log(JSON.stringify({
    recipe, out: path.relative(repo, out), size: result.size,
    height: Math.round(result.height * 10) / 10, volume: Math.round(result.volume), price: result.price,
    ...(result.palette.length ? { palette: result.palette.map(swatch => `${swatch.hex} ${Math.round(swatch.share * 100)}%`) } : {}),
  }))
} finally {
  await browser.close()
  await server.close()
}
