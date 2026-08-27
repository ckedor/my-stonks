/* O agrupamento e o modo de exibição da listagem de ativos.
 *
 * Moram aqui porque a página passou a ser dona deles — os filtros são
 * `actions` do cabeçalho — e tanto a barra quanto a listagem precisam do
 * mesmo tipo. */

export type AssetGroupBy = 'category' | 'asset' | 'type' | 'class' | 'broker'

export type AssetListView = 'list' | 'card'

const VIEW_STORAGE_KEY = 'my-stonks:asset-list-view'

/** A escolha entre lista e cards é uma preferência de leitura, não um estado
 *  da sessão: quem prefere cards os quer de novo na próxima visita. */
export function readAssetListView(): AssetListView {
  if (typeof window === 'undefined') return 'list'
  return window.localStorage.getItem(VIEW_STORAGE_KEY) === 'card' ? 'card' : 'list'
}

export function storeAssetListView(view: AssetListView) {
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, view)
  } catch {
    // Armazenamento cheio ou bloqueado não pode quebrar a listagem.
  }
}
