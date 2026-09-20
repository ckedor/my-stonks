import { useNavigate } from 'react-router-dom'

import { type AiFeature, type AiFreshness } from '@/api/ai'
import {
  AppButton,
  AppChip,
  AppSimpleTable,
  type AppSimpleTableColumn,
  AppStack,
  PageTitle,
} from '@/components/ui'
import { useAiFeatures } from '@/queries/ai'
import CrudPageSkeleton from '../CrudPageSkeleton'

/* A listagem das features de IA: o que cada uma é, e quando a resposta dela
 * expira. Abrir uma leva para a tela dela, onde configuração, prompt e
 * execução vivem juntos.
 *
 * Não há criar nem apagar. Uma feature existe porque há um handler em código
 * que sabe montar o contexto dela e validar a resposta — cadastrar uma linha
 * aqui sem esse handler criaria uma feature que não roda. */

const FRESHNESS_LABEL: Record<AiFreshness, string> = {
  time: 'Expira por tempo',
  manual: 'Só sai por refresh',
}

export default function AdminAiFeaturesPage() {
  const { features, loading } = useAiFeatures()
  const navigate = useNavigate()

  const columns: AppSimpleTableColumn<AiFeature>[] = [
    { label: 'Chave', render: (feature: AiFeature) => feature.key },
    { label: 'Nome', render: (feature: AiFeature) => feature.name },
    {
      label: 'Validade',
      render: (feature: AiFeature) => (
        <AppChip
          label={feature.freshness === 'time' ? `${feature.ttl_hours}h` : FRESHNESS_LABEL.manual}
          emphasis="outline"
        />
      ),
    },
    {
      label: 'Ativa',
      render: (feature: AiFeature) => (
        <AppChip
          label={feature.enabled ? 'Sim' : 'Não'}
          tone={feature.enabled ? 'success' : 'neutral'}
        />
      ),
    },
    {
      label: '',
      render: (feature: AiFeature) => (
        <AppButton
          emphasis="ghost"
          size="sm"
          onClick={() => navigate(`/admin/ai-features/${feature.key}`)}
        >
          Abrir
        </AppButton>
      ),
    },
  ]

  if (loading) return <CrudPageSkeleton columns={5} action={false} search={false} rows={4} />

  return (
    <AppStack gap="lg">
      <PageTitle>Funcionalidades de IA</PageTitle>

      <AppSimpleTable<AiFeature>
        columns={columns}
        rows={features}
        getRowKey={(feature: AiFeature) => feature.key}
        emptyMessage="Nenhuma funcionalidade de IA cadastrada."
      />
    </AppStack>
  )
}
