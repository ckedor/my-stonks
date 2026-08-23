import { describe, expect, it } from 'vitest'

import { allThemes } from './themes'

/* A aba selecionada da barra sumiu no Pixel Art, e não por descuido de cor:
   `activeText` e `activeBg` são um par — texto sobre fundo —, mas a aba
   selecionada é um sublinhado sem fundo nenhum. Nos temas antigos `activeText`
   é branco e funcionava por acaso; nos novos é escuro, porque foi escolhido
   para contrastar com um `activeBg` vivo.

   O `AppTopbar` passou a escolher pelo contraste medido. Este teste é o que
   garante que a escolha existe para todo tema: sem ele, um preset novo com as
   duas cores escuras entraria mudo e ninguém veria até abrir a tela. */

function relativeLuminance(color: string): number {
  const hex = color.replace('#', '')
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex
  const channels = [0, 2, 4].map((i) => {
    const value = parseInt(full.slice(i, i + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrastRatio(a: string, b: string): number {
  const [x, y] = [relativeLuminance(a), relativeLuminance(b)]
  const [lighter, darker] = x > y ? [x, y] : [y, x]
  return (lighter + 0.05) / (darker + 0.05)
}

/* 3:1 é o piso do WCAG para texto grande e para elemento de interface — que é
   o que a aba é: rótulo curto, em negrito, com um sublinhado de 2px. */
const MIN_CONTRAST = 3

describe('destaque da aba selecionada na barra', () => {
  it('toda paleta tem ao menos uma cor de destaque legível sobre a barra', () => {
    for (const { name, theme } of allThemes) {
      const { topbar } = theme.palette
      const best = Math.max(
        contrastRatio(topbar.activeText, topbar.background),
        contrastRatio(topbar.activeBg, topbar.background),
      )
      expect(`${name}: ${best.toFixed(2)}`).toBe(
        `${name}: ${Math.max(best, MIN_CONTRAST).toFixed(2)}`,
      )
    }
  })
})
