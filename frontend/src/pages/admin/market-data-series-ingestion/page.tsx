import { DataIngestionPage } from '../ingestion/DataIngestionPage'

export default function AdminMarketDataSeriesIngestionPage() {
  return (
    <DataIngestionPage
      ingestionType="market_data_series"
      title="Importação de séries de mercado"
      description="Histórico persistido de todos os indicadores e índices de mercado cadastrados."
      itemName="série"
    />
  )
}
