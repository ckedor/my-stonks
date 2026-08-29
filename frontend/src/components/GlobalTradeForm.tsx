import { useConsolidatePortfolio, useSelectedPortfolio } from '@/queries/portfolio'
import { useTradeFormStore } from '@/stores/trade-form'
import TradeForm from './TradeForm'

export default function GlobalTradeForm() {
  const { isOpen, preSelectedAsset, closeTradeForm } = useTradeFormStore()
  const selectedPortfolio = useSelectedPortfolio()
  const consolidate = useConsolidatePortfolio()

  const handleSave = () => {
    if (selectedPortfolio) consolidate.mutate()
  }

  return (
    <TradeForm
      open={isOpen}
      onClose={closeTradeForm}
      onSave={handleSave}
      initialAsset={preSelectedAsset}
    />
  )
}
