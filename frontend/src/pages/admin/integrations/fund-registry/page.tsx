import { DataIngestionPage } from '../ingestion/DataIngestionPage'

export default function AdminFundRegistryIngestionPage() {
  return (
    <DataIngestionPage
      ingestionType="fund_registry"
      title="Cadastro de fundos (CVM)"
      routineKey="fund_registry"
      description="Fundos, classes, subclasses e condições publicados pela CVM. Não cria ativos."
      itemName="arquivo"
      forceFullHistoryDescription="Essa execução lê os dois arquivos mesmo que a CVM informe que não mudaram desde a última leitura."
    />
  )
}
