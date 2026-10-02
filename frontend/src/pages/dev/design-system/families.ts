/* As famílias do catálogo do design system, na ordem do menu.
 *
 * Cada família junta os componentes pelo trabalho que fazem, e não pelo nome:
 * os seis jeitos de escolher uma opção ficam na mesma tela, lado a lado, e é
 * aí que se vê quando dois deles fazem a mesma coisa. Esta lista é a única
 * fonte: as rotas, o menu das ferramentas de dev e a regressão visual leem
 * daqui. */

export const DESIGN_SYSTEM_PATH = '/dev/design-system'

/** O estúdio de temas mora na mesma seção do menu, fora das famílias. */
export const THEME_STUDIO_PATH = `${DESIGN_SYSTEM_PATH}/temas`

export const DESIGN_SYSTEM_FAMILIES = [
  {
    slug: 'fundamentos',
    label: 'Fundamentos',
    description: 'Cor, intenção, espaço e os primitivos de layout de que todo o resto é feito.',
  },
  {
    slug: 'texto',
    label: 'Texto e hierarquia',
    description: 'Os três níveis de título, o texto corrido e o cabeçalho de tela.',
  },
  {
    slug: 'acoes',
    label: 'Ações',
    description: 'O que se clica para fazer alguma coisa: botões, links e menus.',
  },
  {
    slug: 'escolha',
    label: 'Escolha de opção',
    description: 'Os jeitos de escolher entre poucas opções, do mais leve ao mais pesado.',
  },
  {
    slug: 'campos',
    label: 'Campos',
    description: 'Onde se escreve ou escolhe um valor, em cada estado: vazio, preenchido, erro.',
  },
  {
    slug: 'feedback',
    label: 'Feedback e estado',
    description: 'Como a tela diz o que aconteceu, o que falta e em que pé está.',
  },
  {
    slug: 'espera',
    label: 'Espera',
    description: 'A reserva do que vem: o esqueleto ocupa o espaço final enquanto o dado não chega.',
  },
  {
    slug: 'numeros',
    label: 'Números',
    description: 'Um número com o nome dele, e as séries pequenas que cabem ao lado.',
  },
  {
    slug: 'tabelas',
    label: 'Tabelas e listas',
    description: 'Linhas de dado: a tabela, as composições dela e as listas.',
  },
  {
    slug: 'superficies',
    label: 'Superfícies e sobreposições',
    description: 'O card e o que aparece por cima da tela: diálogo, painel lateral, balão.',
  },
  {
    slug: 'graficos',
    label: 'Gráficos',
    description: 'A área de gráfico e os gráficos do design system.',
  },
] as const

export type DesignSystemFamilySlug = (typeof DESIGN_SYSTEM_FAMILIES)[number]['slug']

export const designSystemFamilyPath = (slug: DesignSystemFamilySlug) =>
  `${DESIGN_SYSTEM_PATH}/${slug}`
