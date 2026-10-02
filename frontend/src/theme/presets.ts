import { fontStacks } from './tokens'
import type { ThemePaletteConfig, ThemeShapeConfig } from './themes'

/* ──────────────────────────────────────────────
   Presets — todo tema do app, escrito por extenso
   ──────────────────────────────────────────────

   Um preset é paleta mais forma: as cores, as duas fontes, a escala de raio
   e se as superfícies são quietas (borda em vez de sombra). Todos estão
   aqui, no mesmo formato literal que o estúdio de temas do admin
   (`/admin/design-system/temas`) exporta. Criar um tema é montá-lo lá,
   copiar a definição e colá-la nesta lista; o commit é o que o publica.

   `themes.test.ts` e `topbar-contrast.test.ts` rodam sobre esta lista
   inteira: texto e sinal legíveis sobre o card, e a aba da barra legível
   sobre a barra. O estúdio mostra as mesmas réguas enquanto se edita.

   Duas regras que os testes não pegam e que valem para todo preset:

   - `warning` é a linha do benchmark no gráfico de rentabilidade, ao lado da
     linha da carteira em `primary`. As duas precisam ser matizes distintos.
   - As cores de série (`chart.colors`) não repetem `primary` nem
     `secondary`: o gráfico de rentabilidade usa essas duas fixas, e o resto
     das séries vem daqui por índice. */

export interface ThemePreset {
  /** Fica no localStorage de quem escolheu o tema: mudar um id troca, em
   *  silêncio, o tema dessa pessoa pelo padrão. */
  id: string
  name: string
  description: string
  palette: ThemePaletteConfig
  shape: ThemeShapeConfig
}

/* ══════════════════════════════════════════════
   Tinta — o padrão claro, e o escuro dele
   ══════════════════════════════════════════════

   O preto e o marfim são o palco, e o coral é quem entra nele.

   A primeira versão tinha uma terracota escura (#AC573C) de acento, e a tela
   lia como preto e branco mesmo assim: escura daquele jeito, sobre marfim,
   ela chega ao olho como mais uma tinta. E o lugar onde o olho mais bate — a
   aba selecionada da barra — não usava o acento nenhum, porque `activeText`
   repetia a tinta do resto da barra. Cor de destaque que não aparece onde se
   olha não é destaque, é uma entrada na paleta.

   Agora o coral é o mesmo em toda parte: preenche o botão, desenha a linha
   da Carteira nos gráficos e acende a aba ativa.

   O sinal é verde e vermelho de verdade, em par: um verde com croma e um
   vermelho apagado ao lado dele leem como duas linguagens na mesma tabela.
   As séries são próprias porque, com um acento quente, uma série de terras
   vizinhas vira quase a mesma cor da linha da Carteira. */
const tintaShape: ThemeShapeConfig = {
  radius: { sm: 2, md: 3, lg: 3, pill: 9999 },
  fontFamily: fontStacks.figtree,
  headingFontFamily: fontStacks.sourceSerif,
  quiet: true,
}

const tintaLight: ThemePreset = {
  id: 'earth-tinta-light',
  name: 'Tinta',
  description: 'Preto e marfim com um coral quente de destaque e títulos em serifa.',
  palette: {
    mode: 'light',
    background: { default: '#F7F6F2', paper: '#FFFFFF' },
    text: { primary: '#252421', secondary: '#696762' },
    primary: '#BB5630',
    secondary: '#87644E',
    error: '#C0392F',
    warning: '#88632E',
    success: '#0F7A4B',
    info: '#696762',
    golden: '#88632E',
    dark: '#171614',
    sidebar: '#262521',
    topbar: { background: '#262521', text: '#D1CCC3', activeText: '#EDA37C', activeBg: '#46423A' },
    divider: '#DDDAD3',
    chart: {
      grid: '#DDDAD3',
      label: '#696762',
      colors: ['#2E6E7E', '#7A5AA0', '#4E7A45', '#9C6B2E', '#A34059', '#56707F', '#6E7A34', '#8C4A78'],
    },
  },
  shape: tintaShape,
}

const tintaDark: ThemePreset = {
  id: 'earth-tinta-dark',
  name: 'Tinta',
  description: 'Preto e marfim com um coral quente de destaque e títulos em serifa.',
  palette: {
    mode: 'dark',
    background: { default: '#10100F', paper: '#191918' },
    text: { primary: '#EAE7DF', secondary: '#ABA79F' },
    primary: '#E08659',
    secondary: '#BA9276',
    error: '#E8736A',
    warning: '#C6AB75',
    success: '#57C88E',
    info: '#ABA79F',
    golden: '#C6AB75',
    dark: '#171614',
    sidebar: '#10100F',
    topbar: { background: '#10100F', text: '#BCB6AB', activeText: '#E8956B', activeBg: '#2D2A25' },
    divider: '#33322E',
    chart: {
      grid: '#33322E',
      label: '#ABA79F',
      colors: ['#6FB3C4', '#A896D8', '#86B87A', '#D2A85F', '#D98098', '#93A9BA', '#B4BE73', '#C88FB4'],
    },
  },
  shape: tintaShape,
}

/* ══════════════════════════════════════════════
   Petróleo — o escuro que não é preto
   ══════════════════════════════════════════════

   O Tinta escuro é um quase-preto. Este é um azul-petróleo profundo, na linha
   de painéis de dado de mercado: fundo que se lê como cor e não como apagão,
   e texto quase branco em vez do branco puro, que ofusca sobre fundo escuro.

   O acento é o coral do Tinta claro. Na tinta exata (#BB5630) ele dá 2,5:1
   sobre o card — ilegível em aba e link —, então entra clareado no mesmo
   matiz (#EA9670, 4,6:1), como o próprio Tinta escuro faz; na barra, a aba
   ativa usa o pêssego que o Tinta claro já usa ali (#EDA37C). A tipografia
   também é a do Tinta: trocar entre o claro e o escuro troca a luz, não a
   voz da tela.

   Azul-petróleo, e não verde-petróleo: a primeira versão (#16323D) puxava
   para o verde. Mesma claridade no fundo; o card sobe um degrau para se
   destacar dele (1,28:1). */
const petroleo: ThemePreset = {
  id: 'petroleo',
  name: 'Petróleo',
  description: 'Azul-petróleo profundo, texto marfim e o coral do Tinta.',
  palette: {
    mode: 'dark',
    background: { default: '#182F42', paper: '#24405A' },
    text: { primary: '#E3EAEE', secondary: '#A6B7C4' },
    primary: '#EA9670',
    secondary: '#7CC0D1',
    error: '#F59488',
    warning: '#E2B25C',
    success: '#66CE9B',
    info: '#7CC0D1',
    golden: '#D2A85F',
    dark: '#10253A',
    sidebar: '#10253A',
    topbar: { background: '#10253A', text: '#C3D1DC', activeText: '#EDA37C', activeBg: '#223F58' },
    divider: 'rgba(227,234,238,0.12)',
    chart: {
      grid: 'rgba(227,234,238,0.08)',
      label: '#C3D1DC',
      colors: ['#9FD3DF', '#A896D8', '#86B87A', '#D2A85F', '#D98098', '#93A9BA', '#B4BE73', '#C88FB4'],
    },
  },
  shape: {
    radius: { sm: 2, md: 3, lg: 3, pill: 9999 },
    fontFamily: fontStacks.figtree,
    headingFontFamily: fontStacks.sourceSerif,
    quiet: true,
  },
}

/* ══════════════════════════════════════════════
   Grafite — o neutro frio de painel financeiro
   ══════════════════════════════════════════════

   Cinza-azulado, azul de destaque, uma grotesca só e cantos de 8px. É o
   único claro com sombra nas superfícies: o card sobe da página em vez de
   ser desenhado por uma linha. */
const grafite: ThemePreset = {
  id: 'grafite-light',
  name: 'Grafite',
  description: 'Cinza frio de painel, azul de destaque e superfícies com sombra.',
  palette: {
    mode: 'light',
    background: { default: '#F4F5F7', paper: '#FFFFFF' },
    text: { primary: '#1B1F24', secondary: '#5B6470' },
    primary: '#2457C5',
    secondary: '#6B7A90',
    error: '#C4302B',
    warning: '#B26A00',
    success: '#137A4A',
    info: '#2F6FB3',
    golden: '#A87A1E',
    dark: '#1B1F24',
    sidebar: '#1F2630',
    topbar: { background: '#1F2630', text: '#C9D1DC', activeText: '#FFFFFF', activeBg: '#33404F' },
    divider: '#E1E4E8',
    chart: {
      grid: '#E7EAEE',
      label: '#5B6470',
      colors: ['#0F9D8A', '#D9822B', '#8E5CC9', '#C2456B', '#4F8F3A', '#5A6B7F', '#B59A2F', '#7A6F9B'],
    },
  },
  shape: {
    radius: { sm: 4, md: 8, lg: 8, pill: 9999 },
    fontFamily: fontStacks.grotesk,
    headingFontFamily: fontStacks.grotesk,
  },
}

/* ══════════════════════════════════════════════
   Papel — tinta azul sobre papel de caderno
   ══════════════════════════════════════════════

   Fundo de papel quente, azul-tinteiro de destaque e bordô de apoio, títulos
   em serifa. Os cantos quase retos e a superfície sem sombra são o que faz a
   tela parecer impressa. */
const papel: ThemePreset = {
  id: 'papel-light',
  name: 'Papel',
  description: 'Papel quente, azul-tinteiro e bordô, títulos em serifa.',
  palette: {
    mode: 'light',
    background: { default: '#F5F1E8', paper: '#FFFDF8' },
    text: { primary: '#22201B', secondary: '#6B655A' },
    primary: '#2B4C7E',
    secondary: '#8C3B4A',
    error: '#B23A35',
    warning: '#9A6B1F',
    success: '#2E7D4F',
    info: '#4A6A8C',
    golden: '#9A6B1F',
    dark: '#22201B',
    sidebar: '#2B2823',
    topbar: { background: '#2B2823', text: '#D8D1C4', activeText: '#E9C88A', activeBg: '#3D3830' },
    divider: '#E3DCCD',
    chart: {
      grid: '#E8E2D5',
      label: '#6B655A',
      colors: ['#2E7A7A', '#C0703A', '#6E5A9E', '#8A8F3C', '#B5546E', '#4F6F52', '#A07D3B', '#5C7C9E'],
    },
  },
  shape: {
    radius: { sm: 2, md: 4, lg: 4, pill: 9999 },
    fontFamily: fontStacks.figtree,
    headingFontFamily: fontStacks.sourceSerif,
    quiet: true,
  },
}

/* ══════════════════════════════════════════════
   Oceano — branco limpo e verde-azulado
   ══════════════════════════════════════════════

   O mais arredondado dos claros (12px no card), com o coral como apoio do
   verde-azulado. A barra é um petróleo claro o bastante para não pesar sobre
   uma página quase branca. */
const oceano: ThemePreset = {
  id: 'oceano-light',
  name: 'Oceano',
  description: 'Branco limpo, verde-azulado de destaque e cantos arredondados.',
  palette: {
    mode: 'light',
    background: { default: '#F2F7F8', paper: '#FFFFFF' },
    text: { primary: '#10282E', secondary: '#4F6A70' },
    primary: '#0E7C86',
    secondary: '#D2694C',
    error: '#C23B3B',
    warning: '#B07418',
    success: '#13804A',
    info: '#2B6CB0',
    golden: '#B07418',
    dark: '#10282E',
    sidebar: '#0F3B44',
    topbar: { background: '#0F3B44', text: '#CDE3E6', activeText: '#7FE0E8', activeBg: '#1A525C' },
    divider: '#DCE8EA',
    chart: {
      grid: '#E3EEF0',
      label: '#4F6A70',
      colors: ['#5B5FC7', '#C9A227', '#B5487A', '#4C9A2A', '#8D6E63', '#3D7EA6', '#9C7BD1', '#C0763A'],
    },
  },
  shape: {
    radius: { sm: 6, md: 12, lg: 12, pill: 9999 },
    fontFamily: fontStacks.figtree,
    headingFontFamily: fontStacks.figtree,
  },
}

/* ══════════════════════════════════════════════
   Ameixa — lilás neutro e ameixa
   ══════════════════════════════════════════════

   O neutro puxa de leve para o roxo, e a ameixa é o destaque; o ocre de apoio
   é o complemento dela. Cantos de 14px, os mais macios do catálogo. */
const ameixa: ThemePreset = {
  id: 'ameixa-light',
  name: 'Ameixa',
  description: 'Lilás neutro, ameixa de destaque, ocre de apoio e cantos macios.',
  palette: {
    mode: 'light',
    background: { default: '#F6F3F7', paper: '#FFFFFF' },
    text: { primary: '#231A28', secondary: '#6A5F70' },
    primary: '#7B3F8C',
    secondary: '#B07D24',
    error: '#B8324B',
    warning: '#A86A12',
    success: '#1E7B57',
    info: '#4E6BA6',
    golden: '#A8781F',
    dark: '#231A28',
    sidebar: '#2E2233',
    topbar: { background: '#2E2233', text: '#DCCFE0', activeText: '#E7B6F2', activeBg: '#45324D' },
    divider: '#E6DFE8',
    chart: {
      grid: '#ECE6EE',
      label: '#6A5F70',
      colors: ['#2F8F83', '#D9804A', '#4F7CC2', '#9B9B2F', '#5E8C3A', '#3F6E8C', '#8A5A44', '#6B7FD1'],
    },
  },
  shape: {
    radius: { sm: 8, md: 14, lg: 14, pill: 9999 },
    fontFamily: fontStacks.grotesk,
    headingFontFamily: fontStacks.grotesk,
  },
}

/* ══════════════════════════════════════════════
   Noite — azul-marinho quase preto
   ══════════════════════════════════════════════

   O escuro de produto digital: marinho no fundo, azul elétrico de destaque e
   verde-água de apoio. O sinal é saturado porque sobre um fundo tão escuro o
   verde e o vermelho apagados somem. */
const noite: ThemePreset = {
  id: 'noite-dark',
  name: 'Noite',
  description: 'Marinho quase preto, azul elétrico e verde-água.',
  palette: {
    mode: 'dark',
    background: { default: '#0B1220', paper: '#131C2E' },
    text: { primary: '#E6EAF2', secondary: '#97A3B8' },
    primary: '#4C8DFF',
    secondary: '#2BC4A9',
    error: '#F87171',
    warning: '#FBBF24',
    success: '#4ADE80',
    info: '#60A5FA',
    golden: '#E8C468',
    dark: '#070C16',
    sidebar: '#0E1626',
    topbar: { background: '#0E1626', text: '#B7C2D6', activeText: '#8AB4FF', activeBg: '#1C2A44' },
    divider: '#22304A',
    chart: {
      grid: 'rgba(230,234,242,0.07)',
      label: '#97A3B8',
      colors: ['#F59E6B', '#C084FC', '#F472B6', '#A3E635', '#94A3B8', '#7DD3C0', '#E6C07B', '#D4A5A5'],
    },
  },
  shape: {
    radius: { sm: 6, md: 10, lg: 10, pill: 9999 },
    fontFamily: fontStacks.grotesk,
    headingFontFamily: fontStacks.grotesk,
  },
}

/* ══════════════════════════════════════════════
   Musgo — verde-floresta e ouro
   ══════════════════════════════════════════════

   Escuro esverdeado com ouro de destaque e títulos em serifa — a biblioteca,
   e não o painel. O benchmark sai em salmão, e não em âmbar, porque âmbar ao
   lado da linha dourada da carteira seria uma cor só. */
const musgo: ThemePreset = {
  id: 'musgo-dark',
  name: 'Musgo',
  description: 'Verde-floresta escuro, ouro de destaque e títulos em serifa.',
  palette: {
    mode: 'dark',
    background: { default: '#121A15', paper: '#1A251E' },
    text: { primary: '#E8EDE4', secondary: '#A3B0A2' },
    primary: '#D9B45A',
    secondary: '#8FBF9F',
    error: '#F08A7E',
    warning: '#E59866',
    success: '#7BD39A',
    info: '#8FB8D9',
    golden: '#D9B45A',
    dark: '#0B110D',
    sidebar: '#0F1612',
    topbar: { background: '#0F1612', text: '#BFCBBE', activeText: '#E3C277', activeBg: '#22302A' },
    divider: '#2A3830',
    chart: {
      grid: 'rgba(232,237,228,0.07)',
      label: '#A3B0A2',
      colors: ['#8FC1D4', '#C99AD6', '#E08A9B', '#A7C46A', '#7FB3A3', '#9DB2C8', '#E3B5A0', '#B8C4A0'],
    },
  },
  shape: {
    radius: { sm: 2, md: 4, lg: 4, pill: 9999 },
    fontFamily: fontStacks.figtree,
    headingFontFamily: fontStacks.sourceSerif,
    quiet: true,
  },
}

/* ══════════════════════════════════════════════
   Terminal — fósforo sobre preto
   ══════════════════════════════════════════════

   Mono em tudo, canto nenhum, as cores ANSI de um terminal: ciano no prompt,
   magenta de apoio, verde e vermelho de sinal, amarelo de alerta. A fonte
   mono deixa toda coluna de número alinhada pelo próprio desenho. */
const terminal: ThemePreset = {
  id: 'terminal-dark',
  name: 'Terminal',
  description: 'Preto, cores ANSI, fonte mono e canto nenhum.',
  palette: {
    mode: 'dark',
    background: { default: '#0A0C0A', paper: '#111411' },
    text: { primary: '#D7E6D2', secondary: '#8FA58A' },
    primary: '#4FD6E0',
    secondary: '#D58BE0',
    error: '#FF6E67',
    warning: '#F4F99D',
    success: '#5AF78E',
    info: '#9AA7FF',
    golden: '#E8D44D',
    dark: '#060806',
    sidebar: '#060806',
    topbar: { background: '#060806', text: '#9FB59A', activeText: '#4FD6E0', activeBg: '#1A221A' },
    divider: '#243024',
    chart: {
      grid: 'rgba(215,230,210,0.07)',
      label: '#8FA58A',
      colors: ['#FF9F43', '#9AA7FF', '#FF6AC1', '#C3E88D', '#B4BCC8', '#E6C07B', '#F07178', '#82AAFF'],
    },
  },
  shape: {
    radius: { sm: 0, md: 0, lg: 0, pill: 9999 },
    fontFamily: fontStacks.jetbrainsMono,
    headingFontFamily: fontStacks.jetbrainsMono,
    quiet: true,
  },
}

/** Na ordem em que aparecem para o usuário, os claros e depois os escuros. */
export const THEME_PRESETS: ThemePreset[] = [
  tintaLight,
  grafite,
  papel,
  oceano,
  ameixa,
  tintaDark,
  petroleo,
  noite,
  musgo,
  terminal,
]
