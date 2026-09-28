import { DataIngestionPage } from '../ingestion/DataIngestionPage'

export default function AdminEtfHoldingsIngestionPage() {
  return (
    <DataIngestionPage
      ingestionType="etf_holdings"
      title="Carteira dos ETFs"
      routineKey="etf_holdings"
      description="O que cada ETF americano em carteira possui, posição por posição, do último N-PORT publicado na SEC. Um ETF UCITS não tem fonte: nenhum regulador publica a carteira dele."
      itemName="ETF"
      supportsFullHistory={false}
    />
  )
}
