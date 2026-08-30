import { Box } from '@mui/material'
import { useState } from 'react'

/* O logo de um ativo, do tamanho de uma linha de lista.
 *
 * Sempre por `<img>`, como o `AppIllustration`, e pela mesma razão: a URL vem
 * do provedor de mercado, ou seja, é dado externo, e dado externo não vira
 * marcação. A diferença entre os dois é de papel — aquele é arte que ocupa uma
 * área da tela, este é uma marca ao lado de um ticker.
 *
 * Sem `src`, ou com uma que falhe, não desenha nada: a linha começa no ticker,
 * que é o que identifica o papel. Um quadrado cinza no lugar do logo pareceria
 * um carregamento que nunca termina. */

export interface AppAssetLogoProps {
  /** Nulo, vazio ou quebrado não desenha nada. */
  src?: string | null
  /** Lado do círculo em px. Padrão: 24. */
  size?: number
}

export default function AppAssetLogo({ src, size = 24 }: AppAssetLogoProps) {
  /* Guarda a `src` que falhou, e não um booleano: a mesma instância é
     reaproveitada entre linhas ao rolar a lista, e um booleano esconderia o
     logo seguinte por causa do erro do anterior. */
  const [failed, setFailed] = useState<string | null>(null)

  if (!src || failed === src) return null

  return (
    <Box
      component="img"
      src={src}
      alt=""
      aria-hidden
      loading="lazy"
      onError={() => setFailed(src)}
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        objectFit: 'contain',
        bgcolor: 'background.paper',
      }}
    />
  )
}
