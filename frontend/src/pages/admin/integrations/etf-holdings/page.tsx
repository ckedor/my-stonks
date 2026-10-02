import { DataIngestionPage } from '../ingestion/DataIngestionPage'

export default function AdminEtfHoldingsIngestionPage() {
  return (
    <DataIngestionPage
      ingestionType="etf_holdings"
      title="Carteira dos ETFs"
      routineKey="etf_holdings"
      description="O que cada ETF em carteira possui, posição por posição. O americano vem do último N-PORT publicado na SEC; o UCITS, que nenhum regulador publica, do arquivo da gestora, para as classes cujo arquivo é lido."
      itemName="ETF"
      supportsFullHistory={false}
    />
  )
}
