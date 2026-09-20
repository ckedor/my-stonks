import { fontStacks } from './tokens'
import type { ThemePaletteConfig, ThemeShapeConfig } from './themes'

interface Study {
  key: string
  name: string
  description: string
  body: string
  heading: string
  corners: number
  light?: Swatches
  dark: Swatches
}
interface Swatches {
  background: string
  paper: string
  ink: string
  muted: string
  accent: string
  secondary: string
  navigation: string
  navigationText: string
  active: string
  divider: string
  /** Sinal positivo e negativo, quando o estudo não quer os da família. Vêm
   *  em par de propósito: um verde com croma e um vermelho apagado ao lado
   *  dele leem como duas linguagens na mesma tabela. */
  positive?: string
  negative?: string
  /** Tinta da aba selecionada. Por padrão é a mesma do resto da barra, o que
   *  deixa o destaque do tema fora do lugar onde o olho mais bate. */
  activeText?: string
  /** Séries de gráfico próprias. A lista da família é de terras vizinhas, e
   *  num estudo cujo acento já é quente a primeira delas vira quase a mesma
   *  cor da linha da Carteira — duas séries, um tom só. */
  chartColors?: string[]
}
const studies: Study[] = [
  {
    key: 'argila',
    name: 'Argila',
    description: 'Neutros quentes, títulos serifados e detalhes em terracota.',
    body: fontStacks.figtree,
    heading: fontStacks.newsreader,
    corners: 7,
    light: {
      background: '#F5F3EE',
      paper: '#FDFCF9',
      ink: '#292621',
      muted: '#726B63',
      accent: '#B15A3D',
      secondary: '#7B6959',
      navigation: '#EDEAE3',
      navigationText: '#514B43',
      active: '#EAD6CB',
      divider: '#DEDAD2',
    },
    dark: {
      background: '#171614',
      paper: '#211F1C',
      ink: '#EDE9E1',
      muted: '#B0A79B',
      accent: '#D4987A',
      secondary: '#B5A18C',
      navigation: '#141311',
      navigationText: '#BEB5A8',
      active: '#302923',
      divider: '#39342E',
    },
  },
  {
    key: 'tinta',
    name: 'Tinta',
    /* O preto e o marfim são o palco, e o coral é quem entra nele.
     *
     * A primeira versão tinha uma terracota escura (#AC573C) de acento, e a
     * tela lia como preto e branco mesmo assim: escura daquele jeito, sobre
     * marfim, ela chega ao olho como mais uma tinta. E o lugar onde o olho
     * mais bate — a aba selecionada da barra — não usava o acento nenhum,
     * porque `activeText` repetia a tinta do resto da barra. Cor de destaque
     * que não aparece onde se olha não é destaque, é uma entrada na paleta.
     *
     * Agora o coral é o mesmo em toda parte: preenche o botão, desenha a
     * linha da Carteira nos gráficos e acende a aba ativa. */
    description: 'Preto e marfim com um coral quente de destaque e títulos em serifa.',
    body: fontStacks.figtree,
    heading: fontStacks.sourceSerif,
    corners: 3,
    light: {
      background: '#F7F6F2',
      paper: '#FFFFFF',
      ink: '#252421',
      muted: '#696762',
      accent: '#BB5630',
      secondary: '#87644E',
      navigation: '#262521',
      navigationText: '#D1CCC3',
      active: '#46423A',
      activeText: '#EDA37C',
      divider: '#DDDAD3',
      positive: '#0F7A4B',
      negative: '#C0392F',
      chartColors: [
        '#2E6E7E', '#7A5AA0', '#4E7A45', '#9C6B2E',
        '#A34059', '#56707F', '#6E7A34', '#8C4A78',
      ],
    },
    dark: {
      background: '#10100F',
      paper: '#191918',
      ink: '#EAE7DF',
      muted: '#ABA79F',
      accent: '#E08659',
      secondary: '#BA9276',
      navigation: '#10100F',
      navigationText: '#BCB6AB',
      active: '#2D2A25',
      activeText: '#E8956B',
      divider: '#33322E',
      positive: '#57C88E',
      negative: '#E8736A',
      chartColors: [
        '#6FB3C4', '#A896D8', '#86B87A', '#D2A85F',
        '#D98098', '#93A9BA', '#B4BE73', '#C88FB4',
      ],
    },
  },
  {
    key: 'calcario',
    name: 'Calcário',
    description: 'Arquitetônico: pedra, taupe e Figtree em toda a interface. Quase monocromático.',
    body: fontStacks.figtree,
    heading: fontStacks.figtree,
    corners: 4,
    dark: {
      background: '#1A1B19',
      paper: '#242522',
      ink: '#E4E5DD',
      muted: '#ACAEA3',
      accent: '#C0B5A2',
      secondary: '#AB9781',
      navigation: '#1A1B19',
      navigationText: '#B5B7AB',
      active: '#33352F',
      divider: '#3E4038',
    },
  },
  {
    key: 'cafe',
    name: 'Café',
    description: 'Acolhedor: cacau discreto, papel creme e títulos literários. Sem efeito sépia.',
    body: fontStacks.figtree,
    heading: fontStacks.newsreader,
    corners: 10,
    dark: {
      background: '#1C1715',
      paper: '#28211D',
      ink: '#EBE1D8',
      muted: '#B7A599',
      accent: '#CAA084',
      secondary: '#C0AB8A',
      navigation: '#161210',
      navigationText: '#C5B2A3',
      active: '#382A22',
      divider: '#44372E',
    },
  },
  {
    key: 'cinza-rose',
    name: 'Cinza rosé',
    description: 'Silencioso: cinzas neutros com um acento de rosa antigo, seco e pouco saturado.',
    body: fontStacks.figtree,
    heading: fontStacks.figtree,
    corners: 6,
    dark: {
      background: '#191717',
      paper: '#252121',
      ink: '#E9E2DF',
      muted: '#B2A4A3',
      accent: '#C29796',
      secondary: '#B6A08C',
      navigation: '#191717',
      navigationText: '#BCACAB',
      active: '#372C2D',
      divider: '#403535',
    },
  },
  {
    key: 'ambar',
    name: 'Âmbar',
    description:
      'Preciso: detalhes de latão fosco sobre neutros, títulos sem serifa e cantos retos.',
    body: fontStacks.grotesk,
    heading: fontStacks.figtree,
    corners: 2,
    dark: {
      background: '#131310',
      paper: '#20201A',
      ink: '#E9E6D9',
      muted: '#B2AD97',
      accent: '#C6AB75',
      secondary: '#B79C83',
      navigation: '#10100D',
      navigationText: '#BEB69E',
      active: '#302C20',
      divider: '#3C392C',
    },
  },
]

function palette(swatches: Swatches, mode: 'light' | 'dark'): ThemePaletteConfig {
  const light = mode === 'light'
  return {
    mode,
    background: { default: swatches.background, paper: swatches.paper },
    text: { primary: swatches.ink, secondary: swatches.muted },
    primary: swatches.accent,
    secondary: swatches.secondary,
    // Signs retain different hues, without fluorescent green or red. The
    // family default is an ochre, which reads as "positive" only next to the
    // red — a study that wants the green says so in its own swatches.
    success: swatches.positive ?? (light ? '#766038' : '#C5B18A'),
    error: swatches.negative ?? (light ? '#A04D48' : '#D5948C'),
    warning: light ? '#88632E' : '#C6AB75',
    info: swatches.muted,
    golden: light ? '#88632E' : '#C6AB75',
    dark: '#171614',
    sidebar: swatches.navigation,
    topbar: {
      background: swatches.navigation,
      text: swatches.navigationText,
      activeText: swatches.activeText ?? swatches.navigationText,
      activeBg: swatches.active,
    },
    divider: swatches.divider,
    chart: {
      grid: swatches.divider,
      label: swatches.muted,
      colors:
        swatches.chartColors ??
        (light
          ? ['#A44F36', '#78613B', '#8A5263', '#62605A', '#916F52', '#716273', '#A15249', '#514437']
          : ['#D19779', '#C6B17D', '#B88E9D', '#B4B0A5', '#AD8B65', '#A69AAE', '#D48E86', '#D6C3AB']),
    },
  }
}

export const earthStudies = studies.flatMap((study) =>
  (['light', 'dark'] as const).flatMap((mode) => {
    const swatches = study[mode]
    if (!swatches) return []
    return [{
      id: `earth-${study.key}-${mode}`,
      name: study.name,
      description: study.description,
      palette: palette(swatches, mode),
      shape: {
        radius: {
          sm: Math.max(2, study.corners - 2),
          md: study.corners,
          lg: study.corners,
          pill: 9999,
        },
        fontFamily: study.body,
        headingFontFamily: study.heading,
        quiet: true,
      } satisfies ThemeShapeConfig,
    }]
  })
)
