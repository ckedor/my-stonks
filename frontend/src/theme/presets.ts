import { fontStacks } from './tokens'
import type { ThemePaletteConfig, ThemeShapeConfig } from './themes'

/* ──────────────────────────────────────────────
   Presets — todo tema do app, escrito por extenso
   ──────────────────────────────────────────────

   Um preset é paleta mais forma: as cores, as duas fontes, a escala de raio
   e se as superfícies são quietas (borda em vez de sombra). Todos estão
   aqui, no mesmo formato literal que o estúdio de temas grava — uma
   ferramenta de dev, em `tools/` (`tools/start.sh`). Criar ou ajustar um
   tema é montá-lo lá e salvar: o estúdio reescreve o bloco do preset, ou
   acrescenta um novo e o põe nesta lista (`tools/server/preset-file.ts`). Os
   comentários entre os presets são escritos à mão e o estúdio não os toca. O
   commit é o que publica.

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
   Penumbra — o Nord, com o azul do Omarchy
   ══════════════════════════════════════════════

   A paleta Nord (a do site do Omarchy): azul-acinzentado frio e texto
   cinza-gelo (#D8DEE9). A página é o degrau mais fundo e o card sobe para o
   #2E3440, o fundo do Nord. O acento é o azul-claro do título do site
   (#8DAFD6), com a aba ativa da barra um tom acima (#A9C4E4).

   Acento azul sobre fundo azul pede o resto longe do azul: o benchmark
   (`warning`) é um terracota suave (#DA9578), complementar da linha da
   carteira, e o apoio (`secondary`, a barra do ano atual em Proventos) é o verde-água do
   Nord, da mesma família do azul.

   Corpo em JetBrains Mono e títulos em Figtree, como no site: a mono alinha
   toda coluna de número, e o título em sans quebra a monotonia dela. */
const penumbra: ThemePreset = {
  id: 'penumbra-dark',
  name: 'Penumbra',
  description: 'Nord: azul-acinzentado escuro, corpo em mono e azul-claro de destaque.',
  palette: {
    mode: 'dark',
    background: { default: '#1E222B', paper: '#2E3440' },
    text: { primary: '#D8DEE9', secondary: '#A0AABC' },
    primary: '#8DAFD6',
    secondary: '#8FBCBB',
    error: '#E0828B',
    warning: '#DA9578',
    success: '#A3BE8C',
    info: '#88C0D0',
    golden: '#EBCB8B',
    dark: '#191C24',
    topbar: { background: '#191C24', text: '#B7C1D2', activeText: '#A9C4E4', activeBg: '#2E3440' },
    divider: 'rgba(216,222,233,0.12)',
    chart: {
      grid: 'rgba(216,222,233,0.08)',
      label: '#B7C1D2',
      colors: ['#A3BE8C', '#EBCB8B', '#E0828B', '#C9A9A6', '#7FA3B8', '#D6B07A', '#9AA5C4', '#D08770'],
    },
  },
  shape: {
    radius: { sm: 2, md: 3, lg: 3, pill: 9999 },
    fontFamily: fontStacks.jetbrainsMono,
    headingFontFamily: fontStacks.figtree,
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
   Nuvem — o claro de ponta a ponta
   ══════════════════════════════════════════════

   Todo outro claro tem a barra escura; este é claro até na moldura, com a
   barra e a coluna brancas sobre uma página cinza-gelo. Azul de destaque, uma
   grotesca só e cantos de 10px: o tema de quem não quer pensar em tema. */
const nuvem: ThemePreset = {
  id: 'nuvem-light',
  name: 'Nuvem',
  description: 'Branco de ponta a ponta, inclusive a barra, com azul de destaque.',
  palette: {
    mode: 'light',
    background: { default: '#F2F4F7', paper: '#FFFFFF' },
    text: { primary: '#1A1D23', secondary: '#5F6672' },
    primary: '#1D64D8',
    secondary: '#64748B',
    error: '#C62828',
    warning: '#B45309',
    success: '#15803D',
    info: '#0369A1',
    golden: '#A16207',
    dark: '#1A1D23',
    topbar: { background: '#FFFFFF', text: '#3D4450', activeText: '#1D64D8', activeBg: '#E6EEFB' },
    divider: '#E3E6EA',
    chart: {
      grid: '#E8EBEF',
      label: '#5F6672',
      colors: ['#0F9D8A', '#D9822B', '#8E5CC9', '#C2456B', '#4F8F3A', '#B59A2F', '#9C6644', '#D16BA5'],
    },
  },
  shape: {
    radius: { sm: 6, md: 10, lg: 10, pill: 9999 },
    fontFamily: fontStacks.grotesk,
    headingFontFamily: fontStacks.grotesk,
    quiet: true,
  },
}

/* ══════════════════════════════════════════════
   Grafite escuro — o escuro neutro
   ══════════════════════════════════════════════

   O Grafite com a luz apagada: cinza frio, sem puxar para azul nem para
   preto, o azul de destaque clareado para se ler sobre o card, e a mesma
   forma do claro — trocar de modo troca a luz, não a voz da tela. */
const grafiteDark: ThemePreset = {
  id: 'grafite-dark',
  name: 'Grafite',
  description: 'Cinza frio escuro, azul de destaque e superfícies com sombra.',
  palette: {
    mode: 'dark',
    background: { default: '#14171C', paper: '#1C2027' },
    text: { primary: '#E6E9EE', secondary: '#9AA3B0' },
    primary: '#6B9BFF',
    secondary: '#94A3B8',
    error: '#F2767A',
    warning: '#F0B44C',
    success: '#5CCB8A',
    info: '#7FB2F0',
    golden: '#E2B65A',
    dark: '#0E1014',
    topbar: { background: '#101318', text: '#C2C9D3', activeText: '#FFFFFF', activeBg: '#2A313C' },
    divider: '#2A2F38',
    chart: {
      grid: 'rgba(230,233,238,0.07)',
      label: '#9AA3B0',
      colors: ['#3CC9B4', '#F0A06A', '#B993F0', '#E683AE', '#9CCB5E', '#D9BE7C', '#C88FB4', '#B4BE73'],
    },
  },
  shape: grafite.shape,
}

/* ══════════════════════════════════════════════
   Minimal — preto sobre branco
   ══════════════════════════════════════════════

   Sem cor de marca: o destaque é o próprio preto — botão, linha da carteira,
   item ativo —, e a cor fica para o que é dado, as séries do gráfico e o
   sinal. Moldura branca como o Nuvem, cards desenhados por borda e cantos de
   12px. */
const minimal: ThemePreset = {
  id: 'minimal-light',
  name: 'Minimal',
  description: 'Preto sobre branco, cor só no dado, cantos macios.',
  palette: {
    mode: 'light',
    background: { default: '#F6F6F6', paper: '#FFFFFF' },
    text: { primary: '#111111', secondary: '#6B6B6B' },
    primary: '#111111',
    secondary: '#8A8A8A',
    error: '#D92D20',
    warning: '#C2410C',
    success: '#12805C',
    info: '#2563EB',
    golden: '#A16207',
    dark: '#111111',
    topbar: { background: '#FFFFFF', text: '#4A4A4A', activeText: '#111111', activeBg: '#EDEDED' },
    divider: '#E6E6E6',
    chart: {
      grid: '#EEEEEE',
      label: '#6B6B6B',
      colors: ['#2563EB', '#E8562A', '#0F9D8A', '#8E5CC9', '#D4A017', '#C2456B', '#4F8F3A', '#5E7186'],
    },
  },
  shape: {
    radius: { sm: 8, md: 12, lg: 12, pill: 9999 },
    fontFamily: fontStacks.grotesk,
    headingFontFamily: fontStacks.grotesk,
    quiet: true,
  },
}

/* ══════════════════════════════════════════════
   Ardósia — moldura cinza-azulada e laranja
   ══════════════════════════════════════════════

   O painel administrativo clássico: barra e coluna em ardósia, página
   cinza-clara, cards brancos e um laranja de destaque. O benchmark sai em
   dourado-oliva, puxado para o amarelo, para não encostar no laranja da
   carteira. */
const ardosia: ThemePreset = {
  id: 'ardosia-light',
  name: 'Ardósia',
  description: 'Moldura cinza-azulada, página clara e laranja de destaque.',
  palette: {
    mode: 'light',
    background: { default: '#EEF1F4', paper: '#FFFFFF' },
    text: { primary: '#1F2933', secondary: '#5B6672' },
    primary: '#D35F2A',
    secondary: '#3E4C5E',
    error: '#C53030',
    warning: '#9A7B16',
    success: '#15803D',
    info: '#2F6FB3',
    golden: '#9A7B16',
    dark: '#1F2933',
    topbar: { background: '#2E3A48', text: '#D3DAE2', activeText: '#F5A26B', activeBg: '#3E4C5E' },
    divider: '#DDE2E8',
    chart: {
      grid: '#E5E9EE',
      label: '#5B6672',
      colors: ['#2F80C9', '#0F9D8A', '#8E5CC9', '#C2456B', '#4F8F3A', '#D16BA5', '#5A62C9', '#8A9A3A'],
    },
  },
  shape: {
    radius: { sm: 4, md: 8, lg: 8, pill: 9999 },
    fontFamily: fontStacks.figtree,
    headingFontFamily: fontStacks.figtree,
  },
}

/* ══════════════════════════════════════════════
   Esmeralda — escuro com verde
   ══════════════════════════════════════════════

   Quase preto neutro com um verde de destaque, o escuro dos apps de
   investimento. O verde da carteira e o do sinal positivo são parentes, de
   propósito: subir é a cor do produto. O botão leva texto escuro, porque
   branco sobre esse verde não se lê. */
const esmeralda: ThemePreset = {
  id: 'esmeralda-dark',
  name: 'Esmeralda',
  description: 'Quase preto, verde de destaque e cantos arredondados.',
  palette: {
    mode: 'dark',
    background: { default: '#151619', paper: '#1E1F23' },
    text: { primary: '#E8EAED', secondary: '#9AA0A8' },
    primary: '#34C77B',
    secondary: '#8FA3B8',
    error: '#F26D6D',
    warning: '#E9B949',
    success: '#5EDB95',
    info: '#6FA8F0',
    golden: '#E2B65A',
    dark: '#0F1012',
    topbar: { background: '#111214', text: '#C4C8CE', activeText: '#6EE0A4', activeBg: '#22352B' },
    divider: '#2B2D32',
    chart: {
      grid: 'rgba(232,234,237,0.07)',
      label: '#9AA0A8',
      colors: ['#6FA8F0', '#F0A06A', '#B993F0', '#E683AE', '#D9BE7C', '#5CC8D0', '#C88FB4', '#E07A6A'],
    },
  },
  shape: {
    radius: { sm: 6, md: 12, lg: 12, pill: 9999 },
    fontFamily: fontStacks.grotesk,
    headingFontFamily: fontStacks.grotesk,
  },
}

/** Na ordem em que aparecem para o usuário, os claros e depois os escuros. */
export const THEME_PRESETS: ThemePreset[] = [
  tintaLight,
  nuvem,
  minimal,
  grafite,
  ardosia,
  oceano,
  papel,
  tintaDark,
  grafiteDark,
  penumbra,
  petroleo,
  esmeralda,
]
