import { DataIngestionPage } from '../ingestion/DataIngestionPage'

export default function AdminEtfRegistryIngestionPage() {
  return (
    <DataIngestionPage
      ingestionType="etf_registry"
      title="Cadastro de ETFs estrangeiros"
      routineKey="etf_registry"
      description="ETFs americanos (SEC) e UCITS (ESMA e GLEIF), com gestora, trust ou guarda-chuva e classes; depois liga cada ETF do cadastro de ativos à sua classe. Não cria ativos."
      itemName="etapa"
      supportsFullHistory={false}
    />
  )
}
