import PortfolioPatrimonyChart from '@/components/PortfolioPatrimonyChart'
import { AppCard, AppText } from '@/components/ui'
import type { PatrimonyEntry } from '@/types'
import { useMemo } from 'react'

interface Props {
  patrimony: PatrimonyEntry[]
  loading: boolean
  cagr: number | null
}

const SERIES_KEY = 'FIIs'

export default function FIIWealthTab({ patrimony, loading, cagr }: Props) {
  const fiiPatrimony = useMemo(
    () => patrimony.map((entry) => ({ ...entry, [SERIES_KEY]: entry.portfolio })),
    [patrimony],
  )

  if (!loading && patrimony.length === 0) {
    return <AppText tone="secondary">Sem histórico de patrimônio dos FIIs.</AppText>
  }

  return (
    <AppCard>
      <PortfolioPatrimonyChart
        patrimonyEvolution={fiiPatrimony}
        selected={SERIES_KEY}
        onSelectedChange={() => {}}
        categoryOptions={[{ value: SERIES_KEY, label: SERIES_KEY }]}
        defaultRate={cagr == null ? null : Number((cagr * 100).toFixed(2))}
        height={480}
        persistKey="fii-patrimony"
      />
    </AppCard>
  )
}
