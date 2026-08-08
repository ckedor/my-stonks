import { DataIngestionPage } from '../ingestion/DataIngestionPage'

export default function AdminQuoteIngestionPage() {
  return (
    <DataIngestionPage
      ingestionType="quote"
      title="Importação de cotações"
      description="Histórico de cotações dos ativos presentes nas carteiras. Nenhuma posição é recalculada aqui."
      itemName="ativo"
    />
  )
}
