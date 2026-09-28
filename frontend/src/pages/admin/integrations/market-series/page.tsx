import { DataIngestionPage } from '../ingestion/DataIngestionPage'

export default function AdminMarketDataSeriesIngestionPage() {
  return (
    <DataIngestionPage
      ingestionType="market_data_series"
      title="Séries de mercado"
      routineKey="market_series"
      description="Histórico persistido de todos os indicadores e índices de mercado cadastrados."
      itemName="série"
    />
  )
}
