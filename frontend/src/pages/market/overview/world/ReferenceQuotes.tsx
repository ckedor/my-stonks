import type { ReactNode } from 'react'
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined'
import CurrencyBitcoinRoundedIcon from '@mui/icons-material/CurrencyBitcoinRounded'
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded'
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined'
import type { LevelReading, RateReading } from '@/api/market'
import { AppGrid, AppMetric, AppMetricRow, AppStack } from '@/components/ui'
import { ReadingCard } from './WorldPieces'
import {
  changeTone,
  copyOf,
  formatLevel,
  peakLevel,
  ratePerYear,
  readingHref,
  signedPercent,
} from './readings'

interface Quote {
  key: string
  name: string
  icon: ReactNode
  value: string
  change: { value: string; tone?: ReturnType<typeof changeTone> }
  peak: string
  href: string | null
}

/* O bitcoin em milhares, com "k": com seis dígitos inteiros, "US$ 122.287"
   não cabe em meia coluna. O número exato está na tela do ativo. */
const THOUSANDS = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
const compactLevel = (reading: LevelReading, value: number) =>
  reading.key === 'btc' ? `US$ ${THOUSANDS.format(value / 1000)}k` : formatLevel(reading, value)

function levelQuote(reading: LevelReading, icon: ReactNode): Quote {
  return {
    key: reading.key,
    name: copyOf(reading.key).title,
    icon,
    value: compactLevel(reading, reading.value),
    change: {
      value: signedPercent(reading.one_year_return),
      tone: changeTone(reading.one_year_return),
    },
    peak: compactLevel(reading, peakLevel(reading)),
    href: readingHref(reading),
  }
}

function rateQuote(reading: RateReading): Quote {
  const change = reading.one_year_ago == null ? null : reading.value - reading.one_year_ago
  const peak = Math.max(...reading.history.map((point) => point.value))
  return {
    key: reading.key,
    name: copyOf(reading.key).title,
    icon: <AccountBalanceOutlinedIcon fontSize="small" />,
    value: ratePerYear(reading.value),
    change: {
      // Taxa contra taxa é diferença, não variação: em pontos percentuais.
      value:
        change == null
          ? '—'
          : `${change > 0 ? '+' : ''}${(change * 100).toFixed(2).replace('.', ',')} p.p.`,
    },
    // Sem "a.a.": o número de cima já diz a unidade.
    peak: ratePerYear(peak).replace(' a.a.', ''),
    href: readingHref(reading),
  }
}

/** Dólar, bitcoin, ouro e CDI, dois por linha, cada um no mesmo card
 *  clicável das bolsas: o número de hoje, os 12 meses e a máxima da série.
 *  Sem gráfico — a trajetória está a um clique, na tela de cada um. A
 *  máxima do dólar conta desde o Plano Real; a do CDI, desde que a série
 *  começa. */
export default function ReferenceQuotes({
  usdBrl,
  bitcoin,
  gold,
  cdi,
}: {
  usdBrl?: LevelReading
  bitcoin?: LevelReading
  gold?: LevelReading
  cdi?: RateReading
}) {
  const quotes = [
    usdBrl && levelQuote(usdBrl, <LanguageRoundedIcon fontSize="small" />),
    bitcoin && levelQuote(bitcoin, <CurrencyBitcoinRoundedIcon fontSize="small" />),
    gold && levelQuote(gold, <WorkspacePremiumOutlinedIcon fontSize="small" />),
    cdi && rateQuote(cdi),
  ].filter((quote): quote is Quote => quote != null)

  return (
    <AppGrid cols={{ xs: 2 }} gap="md">
      {quotes.map((quote) => (
        <ReadingCard key={quote.key} href={quote.href} title={quote.name}>
          <AppStack gap="sm">
            <AppStack direction="row" justify="between" align="start" gap="sm">
              <AppMetric label={quote.name} value={quote.value} size="lg" />
              {quote.icon}
            </AppStack>
            <AppMetricRow>
              <AppMetric label="12 meses" value={quote.change.value} tone={quote.change.tone} />
              <AppMetric label="Máxima" value={quote.peak} />
            </AppMetricRow>
          </AppStack>
        </ReadingCard>
      ))}
    </AppGrid>
  )
}
