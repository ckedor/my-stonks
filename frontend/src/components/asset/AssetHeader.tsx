import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { Box, Link as MuiLink, Stack, Tooltip, Typography } from '@mui/material'
import dayjs from 'dayjs'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

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
  // O provedor anuncia logo para tickers dos quais não tem arte e a URL dá 404,
  // então a própria imagem é o único sinal confiável.
  //
  // Guarda a URL que falhou, e não um booleano: o header não é remontado ao
  // navegar de um ativo para outro, e um booleano deixaria o logo do próximo
  // escondido por causa do erro do anterior.
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null)
  const showLogo = Boolean(logoUrl) && failedLogoUrl !== logoUrl

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
        gap: { xs: 2, md: 4 },
        alignItems: 'start',
      }}
    >
      <Box minWidth={0}>
        <Stack direction="row" alignItems="center" spacing={1.25} flexWrap="wrap" useFlexGap>
          {showLogo && (
            <Box
              component="img"
              src={logoUrl!}
              alt=""
              onError={() => setFailedLogoUrl(logoUrl!)}
              sx={{ width: 28, height: 28, borderRadius: 1, objectFit: 'contain' }}
            />
          )}
          <Typography variant="h4" fontWeight="bold">
            {ticker}
          </Typography>
          {typeShortName && (
            <Typography
              component="span"
              sx={{
                color: 'text.secondary',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                borderRadius: 999,
                bgcolor: 'action.hover',
                px: 1,
                py: 0.375,
              }}
            >
              {typeShortName}
            </Typography>
          )}
        </Stack>

        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 0.5 }}>
          {name && (
            <Typography variant="body1" color="text.secondary">
              {name}
            </Typography>
          )}
          {/* Só o ícone: ao lado do nome do ativo, "Ver no mercado" por extenso
              pesa mais que o próprio nome, e o ícone já é o idioma de "abre em
              outro lugar". O rótulo fica no tooltip. */}
          {marketHref && (
            <Tooltip title="Ver no mercado">
              <MuiLink
                component={Link}
                to={marketHref}
                color="text.secondary"
                aria-label="Ver no mercado"
                sx={{ display: 'inline-flex', '&:hover': { color: 'text.primary' } }}
              >
                <OpenInNewIcon sx={{ fontSize: 16 }} />
              </MuiLink>
            </Tooltip>
          )}
        </Stack>

        {cagr && <CagrLine cagr={cagr} hint={cagrHint} />}
      </Box>

      {action && <Box sx={{ justifySelf: { xs: 'start', md: 'end' } }}>{action}</Box>}
    </Box>
  )
}

/** Uma linha, no registro do subtítulo acima dela: o header está ali para
 *  nomear o ativo, e uma taxa em ladrilhos e caixa alta disputa com o gráfico
 *  uma atenção que ela não merece. */
function CagrLine({ cagr, hint }: { cagr: AssetHeaderCagr; hint?: string }) {
  const label = hint ? (
    <Tooltip title={hint}>
      <Box component="span" sx={{ cursor: 'help' }}>
        CAGR
      </Box>
    </Tooltip>
  ) : (
    'CAGR'
  )

  return (
    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
      {label}{' '}
      <Typography
        component="span"
        variant="body2"
        sx={{ fontWeight: 600, color: cagr.value >= 0 ? 'success.main' : 'error.main' }}
      >
        {cagr.value >= 0 ? '+' : ''}
        {cagr.value.toFixed(2).replace('.', ',')}% a.a.
      </Typography>
      {cagr.startDate && ` desde ${dayjs(cagr.startDate).format('DD/MM/YYYY')}`}
    </Typography>
  )
}
