import { DataIngestionPage } from '../ingestion/DataIngestionPage'

export default function AdminUsdBrlIngestionPage() {
  return (
    <DataIngestionPage
      ingestionType="usd_brl"
      title="Dólar (USD/BRL)"
      routineKey="usd_brl"
      description="Histórico diário da taxa canônica de um dólar em reais."
      itemName="câmbio"
    />
  )
}
