import type { ThemePaletteConfig } from './themes'

/* Contraste de cor, pela fórmula do WCAG.
 *
 * Mora aqui, e não dentro dos testes, porque são duas as pessoas que
 * precisam da mesma régua: os testes de tema, que reprovam um preset
 * ilegível no catálogo, e o estúdio de temas, que mostra a mesma
 * reprovação enquanto se edita. Duas cópias da fórmula divergem no dia em
 * que alguém conserta só uma. */

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

/** Luminância relativa de uma cor `#rgb` ou `#rrggbb`; `null` para qualquer
 *  outra coisa (um `rgba()` de divisor, por exemplo), que não se mede aqui. */
function relativeLuminance(color: string): number | null {
  if (!HEX.test(color)) return null
  const hex = color.slice(1)
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex
  const channels = [0, 2, 4].map((i) => {
    const value = parseInt(full.slice(i, i + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

/** Razão de contraste entre duas cores, de 1 a 21; `null` se uma delas não
 *  for hexadecimal. */
export function contrastRatio(a: string, b: string): number | null {
  const x = relativeLuminance(a)
  const y = relativeLuminance(b)
  if (x == null || y == null) return null
  const [lighter, darker] = x > y ? [x, y] : [y, x]
  return (lighter + 0.05) / (darker + 0.05)
}

export interface ContrastCheck {
  label: string
  ratio: number | null
  min: number
  /** Os testes de tema reprovam o preset que falha nesta régua. As outras são
   *  conselho: o estúdio mostra, o catálogo aceita. */
  enforced: boolean
}

/* 4.5:1 é a régua do WCAG para texto normal; 3:1, a de texto grande e de
   elemento de interface — o rótulo de apoio, a aba em negrito da barra, o
   botão na cor primária. */
export function paletteContrastChecks(palette: ThemePaletteConfig): ContrastCheck[] {
  const paper = palette.background.paper
  const { topbar } = palette
  /* A aba selecionada da barra sumiu no Pixel Art, e não por descuido de cor:
     `activeText` e `activeBg` são um par — texto sobre fundo —, mas a aba
     selecionada é um sublinhado sem fundo nenhum. O `AppTopbar` escolhe entre
     as duas pelo contraste medido, então basta que uma delas se leia sobre a
     barra. */
  const activeTab = Math.max(
    contrastRatio(topbar.activeText, topbar.background) ?? 0,
    contrastRatio(topbar.activeBg, topbar.background) ?? 0,
  )
  return [
    { label: 'Texto sobre o card', ratio: contrastRatio(palette.text.primary, paper), min: 4.5, enforced: true },
    { label: 'Texto de apoio sobre o card', ratio: contrastRatio(palette.text.secondary, paper), min: 3, enforced: true },
    { label: 'Positivo sobre o card', ratio: contrastRatio(palette.success, paper), min: 4.5, enforced: true },
    { label: 'Negativo sobre o card', ratio: contrastRatio(palette.error, paper), min: 4.5, enforced: true },
    { label: 'Aba ativa sobre a barra', ratio: activeTab || null, min: 3, enforced: true },
    { label: 'Texto da barra', ratio: contrastRatio(topbar.text, topbar.background), min: 4.5, enforced: false },
    { label: 'Primária sobre o card', ratio: contrastRatio(palette.primary, paper), min: 3, enforced: false },
  ]
}
