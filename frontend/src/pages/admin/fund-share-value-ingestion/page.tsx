import { DataIngestionPage } from '../ingestion/DataIngestionPage'

export default function AdminFundShareValueIngestionPage() {
  return (
    <DataIngestionPage
      ingestionType="fund_share_value"
      title="Valores de cota"
      description="Valores de cota informados à CVM pelos fundos sem ticker, desde a primeira compra. Às terças, a mesma execução revisa os meses que a CVM republica."
      itemName="fundo"
      showFiles
      forceFullHistoryDescription="Essa execução relê todos os arquivos desde a primeira compra de cada fundo, mesmo os que a CVM informa que não mudaram."
    />
  )
}
