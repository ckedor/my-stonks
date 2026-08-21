import {
  AppChip,
  AppIconLink,
  AppLogoImage,
  AppStack,
  AppText,
  AppTooltip,
} from '@/components/ui'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import dayjs from 'dayjs'
import type { ReactNode } from 'react'

/** Retorno anual composto, em pontos percentuais.
 *
 *  Pontos percentuais, e não fração, porque as duas telas recebem a métrica em
 *  escalas diferentes da API e a conversão tem de acontecer de um lado só — o
 *  de quem conhece a fonte. */
export interface AssetHeaderCagr {
  value: number
  /** Início da série. A taxa não diz muito sem ele: 51% ao ano desde 2010 é
   *  uma afirmação diferente de 51% desde 2023. */
  startDate?: string
}

interface Props {
  ticker: string
  name?: string
  /** Sigla do tipo do ativo: ETF, FII, AÇÃO. */
  typeShortName?: string
  logoUrl?: string | null
  cagr?: AssetHeaderCagr | null
  /** Explicação do CAGR, quando ele precisa de uma. */
  cagrHint?: string
  /** Destino da visão de mercado do ativo, quando faz sentido oferecê-la. */
  marketHref?: string
  /** Espaço à direita, para o que a página precisar pôr ali. */
  action?: ReactNode
}

/** Quem é o ativo, do mesmo jeito na visão de mercado e na de carteira.
 *
 *  A identidade de um ativo não muda com a tela em que ele aparece, então ela é
 *  desenhada em um lugar só: ticker, nome, tipo e classe, e o que ele compôs.
 *  O que varia entre as telas entra por parâmetro — o CAGR acima de tudo, que
 *  na carteira mede a posição e no mercado mede o ativo, e por isso é opcional
 *  em vez de calculado aqui. */
export default function AssetHeader({
  ticker,
  name,
  typeShortName,
  logoUrl,
  cagr,
  cagrHint,
  marketHref,
  action,
}: Props) {
  return (
    <AppStack direction="row" justify="between" align="start" gap="xl" collapseBelow="md">
      <AppStack gap="xs" grow>
        <AppStack direction="row" align="center" gap="sm" wrap>
          <AppLogoImage src={logoUrl} />
          <AppText variant="pageHeading">{ticker}</AppText>
          {typeShortName && <AppChip label={typeShortName} />}
        </AppStack>

        <AppStack direction="row" align="center" gap="xs">
          {name && (
            <AppText variant="body" tone="secondary">
              {name}
            </AppText>
          )}
          {marketHref && (
            <AppTooltip title="Ver no mercado">
              <AppIconLink to={marketHref} label="Ver no mercado">
                <OpenInNewIcon fontSize="inherit" />
              </AppIconLink>
            </AppTooltip>
          )}
        </AppStack>

        {cagr && <CagrLine cagr={cagr} hint={cagrHint} />}
      </AppStack>

      {action}
    </AppStack>
  )
}

/** Uma linha, no registro do subtítulo acima dela: o header está ali para
 *  nomear o ativo, e uma taxa em ladrilhos e caixa alta disputa com o gráfico
 *  uma atenção que ela não merece. */
function CagrLine({ cagr, hint }: { cagr: AssetHeaderCagr; hint?: string }) {
  const label = hint ? (
    <AppTooltip title={hint}>
      <AppText variant="bodySmall" tone="secondary" inline>
        CAGR
      </AppText>
    </AppTooltip>
  ) : (
    'CAGR'
  )

  return (
    <AppText variant="bodySmall" tone="secondary">
      {label}{' '}
      <AppText
        variant="bodySmall"
        weight="strong"
        tone={cagr.value >= 0 ? 'success' : 'danger'}
        inline
      >
        {cagr.value >= 0 ? '+' : ''}
        {cagr.value.toFixed(2).replace('.', ',')}% a.a.
      </AppText>
      {cagr.startDate && ` desde ${dayjs(cagr.startDate).format('DD/MM/YYYY')}`}
    </AppText>
  )
}
