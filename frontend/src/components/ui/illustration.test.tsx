import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import AppIllustration from './AppIllustration'

/* A arte de uma patente é conteúdo enviado pelo admin, e um SVG pode carregar
   `<script>` ou `onload`. O `AppIllustration` existe justamente para que isso
   nunca vire marcação da página: ele renderiza por `<img>`, onde nada disso
   executa. O backend também recusa esses arquivos na gravação — as duas
   barreiras existem porque a coluna sobrevive ao componente que a lê hoje. */

const HOSTILE_SVG =
  `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')}`

describe('AppIllustration', () => {
  it('desenha a arte por img, e nunca injeta a marcação na página', () => {
    const { container } = render(<AppIllustration src={HOSTILE_SVG} height={100} />)

    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')?.getAttribute('src')).toBe(HOSTILE_SVG)
  })

  it('não desenha nada sem arte', () => {
    const { container } = render(<AppIllustration src={null} height={100} />)

    expect(container).toBeEmptyDOMElement()
  })
})
