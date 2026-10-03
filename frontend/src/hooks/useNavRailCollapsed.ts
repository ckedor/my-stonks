import { useState } from 'react'

const COLLAPSED_KEY = 'nav-rail-collapsed'

/* Recolhida ou expandida é preferência de quem usa, e uma que se percebe toda
   vez que a tela abre: sem guardar, a coluna volta larga a cada recarga e o
   ajuste precisa ser refeito. É uma preferência só para a carteira, o admin e
   as ferramentas de dev, porque a coluna é a mesma nas três.

   `localStorage` pode não existir (navegador com armazenamento bloqueado), e
   cair para o padrão é resposta suficiente — não vale derrubar a tela por
   causa disso. */
function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === 'true'
  } catch {
    return false
  }
}

export function useNavRailCollapsed(): [collapsed: boolean, toggle: () => void] {
  const [collapsed, setCollapsed] = useState(readCollapsed)

  const toggle = () =>
    setCollapsed((value) => {
      try {
        window.localStorage.setItem(COLLAPSED_KEY, String(!value))
      } catch {
        /* Preferência é conforto, não dado: perder não muda o que a tela faz. */
      }
      return !value
    })

  return [collapsed, toggle]
}
