/* As leituras de um recorte da carteira.
 *
 * A mesma lista, nos mesmos nomes e na mesma ordem, do grupo "Análise" da
 * Carteira em `src/layouts/navigation.ts`: um recorte é a carteira vista por
 * um pedaço dela, e ler um pedaço não pode ser um aprendizado novo. Risco
 * fecha a lista porque é a leitura que se procura por último.
 *
 * Mora fora do componente porque a navegação também precisa dela — e é o
 * teste que compara as duas que impede que se separem. */

export type SliceTabId =
  | 'rentabilidade'
  | 'patrimonio'
  | 'proventos'
  | 'trades'
  | 'distribuicao'
  | 'risco'

export const SLICE_TABS: { id: SliceTabId; label: string }[] = [
  { id: 'rentabilidade', label: 'Rentabilidade' },
  { id: 'patrimonio', label: 'Patrimônio' },
  { id: 'proventos', label: 'Proventos' },
  { id: 'trades', label: 'Trades' },
  { id: 'distribuicao', label: 'Distribuição' },
  { id: 'risco', label: 'Risco' },
]
