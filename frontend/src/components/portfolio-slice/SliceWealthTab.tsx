import PortfolioPatrimonyChart from '@/components/PortfolioPatrimonyChart'
import { AppCard, AppText } from '@/components/ui'
import type { PatrimonyEntry } from '@/types'
import { useMemo } from 'react'

interface Props {
  /** Evolução patrimonial já recortada, ou a da carteira inteira quando a
   *  coluna do recorte é uma das que ela traz. */
  patrimony: PatrimonyEntry[]
  loading?: boolean
  /** A coluna que o gráfico desenha. */
  seriesKey: string
  /** Quando verdadeiro, a série do recorte é a coluna `portfolio` da resposta
   *  e é renomeada para o rótulo do recorte antes de desenhar. */
  fromPortfolioColumn?: boolean
  /** CAGR do recorte em fração: o que a projeção assume por padrão. */
  cagr: number | null
  persistKey: string
}

/** A evolução patrimonial do recorte.
 *
 *  Sem o gráfico de aportes que a tela da carteira mostra ao lado: `aported`
 *  vem somado por dia para a carteira inteira e não é recortado, então ali ele
 *  seria o número da carteira sob o título de um pedaço dela. */
export default function SliceWealthTab({
  patrimony,
  loading = false,
  seriesKey,
  fromPortfolioColumn = false,
  cagr,
  persistKey,
}: Props) {
  const data = useMemo(
    () =>
      fromPortfolioColumn
        ? patrimony.map((entry) => ({ ...entry, [seriesKey]: entry.portfolio }))
        : patrimony,
    [patrimony, fromPortfolioColumn, seriesKey],
  )

  if (!loading && patrimony.length === 0) {
    return <AppText tone="secondary">Sem histórico de patrimônio para este recorte.</AppText>
  }

  return (
    <AppCard>
      <PortfolioPatrimonyChart
        patrimonyEvolution={data}
        selected={seriesKey}
        /* O recorte é o da página: o seletor não tem para onde levar. */
        onSelectedChange={() => {}}
        categoryOptions={[{ value: seriesKey, label: seriesKey }]}
        defaultRate={cagr == null ? null : Number((cagr * 100).toFixed(2))}
        height={480}
        persistKey={persistKey}
      />
    </AppCard>
  )
}
