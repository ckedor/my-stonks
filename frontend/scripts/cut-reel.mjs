/* Corta e comprime o vídeo gravado por `reel/login-reel.spec.ts` e o põe em
 * `public/`, onde a tela de login o lê.
 *
 * O Playwright grava desde que o browser abre, e o começo é o dev server
 * compilando. O spec anota em `cut.json` quando a tela ficou pronta e
 * quando o roteiro acabou; o corte usa esses dois instantes. */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const OUTPUT = 'reel/.output'
const TARGET = 'public/login-reel.webm'
const POSTER = 'public/login-reel.jpg'

const dir = readdirSync(OUTPUT, { withFileTypes: true }).find((d) => d.isDirectory())
if (!dir) throw new Error(`nenhuma gravação em ${OUTPUT}: rode o Playwright com playwright.reel.config.ts antes`)

const folder = path.join(OUTPUT, dir.name)
const { start, end } = JSON.parse(readFileSync(path.join(folder, 'cut.json'), 'utf8'))
const video = readdirSync(folder).find((f) => f.endsWith('.webm'))
if (!video) throw new Error(`nenhum .webm em ${folder}`)

execFileSync('ffmpeg', [
  '-v', 'error', '-y',
  '-ss', String(start), '-to', String(end),
  '-i', path.join(folder, video),
  '-an', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '36', '-row-mt', '1',
  TARGET,
], { stdio: 'inherit' })

execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', TARGET, '-frames:v', '1', '-q:v', '4', POSTER], {
  stdio: 'inherit',
})

console.log(`${TARGET}: ${(end - start).toFixed(1)} s`)
