import { DataIngestionPage } from '../ingestion/DataIngestionPage'

export default function AdminUsdBrlIngestionPage() {
  return (
    <DataIngestionPage
      ingestionType="usd_brl"
      title="Importação USD/BRL"
      description="Histórico diário da taxa canônica de um dólar em reais."
      itemName="câmbio"
    />
  )
}
