import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import {
  activateAiPromptVersion,
  type AiFeature,
  type AiFeatureForm,
  type AiFreshness,
  type AiPromptVersion,
  createAiPromptVersion,
  fetchAiFeatureForm,
  updateAiFeature,
} from '@/api/ai'
import {
  AppAlert,
  AppButton,
  AppCard,
  AppChip,
  AppFormDrawer,
  AppPageHeader,
  AppSelect,
  AppSimpleTable,
  type AppSimpleTableColumn,
  AppStack,
  AppSwitch,
  AppText,
  AppTextField,
  SectionTitle,
} from '@/components/ui'
import { useAiFeatures, useAiPromptVersions, useRefreshAi } from '@/queries/ai'
import CrudPageSkeleton from '../../CrudPageSkeleton'
import AiFeatureRunner from '../AiFeatureRunner'

/* A tela de uma feature de IA: configuração, prompt e execução no mesmo
 * lugar, porque as três coisas descrevem a mesma feature e mexer numa é
 * quase sempre olhar para as outras duas.
 *
 * Editar o prompt nunca reescreve uma versão: escreve a próxima e a ativa. É
 * o que permite um artefato apontar para o texto exato que o gerou, e o que
 * faz ativar uma versão nova aposentar sozinha as respostas da anterior —
 * sem job de invalidação, e sem perder o que a versão velha respondeu. */

const FRESHNESS_LABEL: Record<AiFreshness, string> = {
  time: 'Expira por tempo',
  manual: 'Só sai por refresh',
}

const MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4.1',
  'gpt-5',
  'claude-sonnet-5',
  'claude-opus-5',
  'claude-haiku-4-5',
]

/* Os modelos de raciocínio recusam `temperature` — a amostragem é decisão
 * deles. O backend descarta o campo antes de chamar; aqui ele some para que
 * ninguém ajuste um número que não vai a lugar nenhum. */
const REASONING_MODEL_PREFIXES = ['gpt-5', 'o1', 'o3', 'o4']

const acceptsTemperature = (model: string) =>
  !REASONING_MODEL_PREFIXES.some((prefix) => model.startsWith(prefix))

const EMPTY_VERSION_DRAFT = {
  system: '',
  template: '',
  model: 'gpt-4o',
  temperature: '0.2',
  maxOutputTokens: '4000',
  webSearch: true,
  notes: '',
  activate: true,
}

export default function AdminAiFeatureDetailPage() {
  const { key = '' } = useParams<{ key: string }>()
  const { features, loading: loadingFeatures } = useAiFeatures()
  const { versions } = useAiPromptVersions(key)
  const refresh = useRefreshAi()

  const feature = features.find((item) => item.key === key)

  const [featureDraft, setFeatureDraft] = useState<AiFeature | null>(null)
  const [featureError, setFeatureError] = useState<string | null>(null)
  const [savingFeature, setSavingFeature] = useState(false)

  useEffect(() => {
    if (feature) setFeatureDraft({ ...feature })
  }, [feature])

  const saveFeature = async () => {
    if (!featureDraft) return
    setSavingFeature(true)
    setFeatureError(null)
    try {
      await updateAiFeature(featureDraft.key, {
        name: featureDraft.name,
        description: featureDraft.description,
        enabled: featureDraft.enabled,
        freshness: featureDraft.freshness,
        ttl_hours: featureDraft.freshness === 'manual' ? null : featureDraft.ttl_hours,
      })
      refresh()
    } catch (caught) {
      setFeatureError(caught instanceof Error ? caught.message : 'Falha ao salvar')
    } finally {
      setSavingFeature(false)
    }
  }

  const [form, setForm] = useState<AiFeatureForm | null>(null)
  const [versionDrawerOpen, setVersionDrawerOpen] = useState(false)
  const [versionDraft, setVersionDraft] = useState(EMPTY_VERSION_DRAFT)
  const [versionError, setVersionError] = useState<string | null>(null)
  const [savingVersion, setSavingVersion] = useState(false)

  useEffect(() => {
    if (!key) return
    let current = true
    fetchAiFeatureForm(key)
      .then((loaded) => current && setForm(loaded))
      .catch(() => current && setForm(null))
    return () => {
      current = false
    }
  }, [key])

  const newVersion = () => {
    setVersionDraft(EMPTY_VERSION_DRAFT)
    setVersionError(null)
    setVersionDrawerOpen(true)
  }

  /* Editar aqui não abre a versão antiga para alterá-la — ela já rodou e
     continua no banco como respondeu. Abre um rascunho com o mesmo texto,
     pronto para virar a próxima versão quando salvo. */
  const editVersion = (version: AiPromptVersion) => {
    setVersionDraft({
      system: version.system,
      template: version.template,
      model: version.model,
      temperature: String(version.temperature),
      maxOutputTokens: String(version.max_output_tokens ?? ''),
      webSearch: version.web_search,
      notes: '',
      activate: true,
    })
    setVersionError(null)
    setVersionDrawerOpen(true)
  }

  const saveVersion = async () => {
    setSavingVersion(true)
    setVersionError(null)
    try {
      await createAiPromptVersion(key, {
        system: versionDraft.system,
        template: versionDraft.template,
        model: versionDraft.model,
        temperature: Number(versionDraft.temperature) || 0,
        max_output_tokens: versionDraft.maxOutputTokens ? Number(versionDraft.maxOutputTokens) : null,
        web_search: versionDraft.webSearch,
        notes: versionDraft.notes,
        activate: versionDraft.activate,
      })
      refresh()
      setVersionDrawerOpen(false)
    } catch (caught) {
      setVersionError(caught instanceof Error ? caught.message : 'Falha ao salvar a versão')
    } finally {
      setSavingVersion(false)
    }
  }

  const activateVersion = async (version: AiPromptVersion) => {
    setVersionError(null)
    try {
      await activateAiPromptVersion(version.id)
      refresh()
    } catch (caught) {
      setVersionError(caught instanceof Error ? caught.message : 'Falha ao ativar')
    }
  }

  const versionColumns: AppSimpleTableColumn<AiPromptVersion>[] = [
    { label: 'Versão', render: (version) => `v${version.version}` },
    { label: 'Modelo', render: (version) => version.model },
    {
      label: 'Busca na web',
      render: (version) => (version.web_search ? 'Sim' : 'Não'),
    },
    {
      label: 'Ativa',
      render: (version) =>
        version.is_active ? <AppChip label="Ativa" tone="success" /> : null,
    },
    {
      label: 'Criada em',
      render: (version) => new Date(version.created_at).toLocaleString('pt-BR'),
    },
    {
      label: '',
      render: (version) => (
        <AppStack direction="row" gap="sm">
          <AppButton emphasis="ghost" size="sm" onClick={() => editVersion(version)}>
            Editar
          </AppButton>
          {!version.is_active && (
            <AppButton emphasis="outline" size="sm" onClick={() => void activateVersion(version)}>
              Ativar
            </AppButton>
          )}
        </AppStack>
      ),
    },
  ]

  if (loadingFeatures) {
    return <CrudPageSkeleton columns={5} action={false} search={false} rows={4} />
  }

  if (!feature || !featureDraft) {
    return <AppAlert tone="danger">Funcionalidade &quot;{key}&quot; não encontrada.</AppAlert>
  }

  return (
    <AppStack gap="lg">
      <AppPageHeader
        title={featureDraft.name}
        breadcrumbs={[
          { label: 'IA' },
          { label: 'Funcionalidades', href: '/admin/ai-features' },
          { label: featureDraft.name },
        ]}
      />

      <AppCard>
        <AppStack gap="md">
          <SectionTitle>Configuração</SectionTitle>
          <AppTextField
            label="Nome"
            value={featureDraft.name}
            onChange={(name) => setFeatureDraft({ ...featureDraft, name })}
          />
          <AppTextField
            label="Descrição"
            value={featureDraft.description}
            onChange={(description) => setFeatureDraft({ ...featureDraft, description })}
            rows={2}
            maxRows={6}
          />
          <AppSelect
            label="Validade"
            value={featureDraft.freshness}
            onChange={(freshness) =>
              setFeatureDraft({ ...featureDraft, freshness: freshness as AiFreshness })
            }
            options={[
              { value: 'manual', label: FRESHNESS_LABEL.manual },
              { value: 'time', label: FRESHNESS_LABEL.time },
            ]}
          />
          {featureDraft.freshness === 'time' && (
            <AppTextField
              label="TTL (horas)"
              type="number"
              value={String(featureDraft.ttl_hours ?? '')}
              onChange={(ttl) => setFeatureDraft({ ...featureDraft, ttl_hours: Number(ttl) || null })}
              helperText="Depois disso a próxima leitura gera de novo."
            />
          )}
          <AppSwitch
            label="Ativa"
            checked={featureDraft.enabled}
            onChange={(enabled) => setFeatureDraft({ ...featureDraft, enabled })}
          />
          {featureError && <AppAlert tone="danger">{featureError}</AppAlert>}
          <AppText variant="caption" tone="secondary">
            Uma feature de validade manual não guarda TTL: a resposta fica até alguém pedir uma
            nova.
          </AppText>
          <AppStack direction="row">
            <AppButton onClick={saveFeature} loading={savingFeature}>
              Salvar
            </AppButton>
          </AppStack>
        </AppStack>
      </AppCard>

      <AppStack gap="md">
        <AppStack direction="row" align="center" justify="between">
          <SectionTitle>Prompt</SectionTitle>
          <AppButton onClick={newVersion}>Nova versão</AppButton>
        </AppStack>
        {versionError && <AppAlert tone="danger">{versionError}</AppAlert>}
        <AppSimpleTable<AiPromptVersion>
          columns={versionColumns}
          rows={versions}
          getRowKey={(version) => String(version.id)}
          emptyMessage="Nenhuma versão de prompt."
        />
      </AppStack>

      <AiFeatureRunner featureKey={key} />

      <AppFormDrawer
        open={versionDrawerOpen}
        onClose={() => setVersionDrawerOpen(false)}
        title="Nova versão de prompt"
        width="lg"
        submitLabel="Salvar versão"
        onSubmit={saveVersion}
        submitDisabled={!versionDraft.template}
        submitting={savingVersion}
      >
        {form && (
          <AppText variant="caption" tone="secondary">
            Dados que o prompt pode citar: {form.context_keys.map((k) => `{${k}}`).join(', ')}
          </AppText>
        )}
        <AppTextField
          label="System"
          value={versionDraft.system}
          onChange={(system) => setVersionDraft({ ...versionDraft, system })}
          rows={6}
          maxRows={16}
          monospace
        />
        <AppTextField
          label="Template"
          value={versionDraft.template}
          onChange={(template) => setVersionDraft({ ...versionDraft, template })}
          rows={12}
          maxRows={30}
          monospace
        />
        <AppSelect
          label="Modelo"
          value={versionDraft.model}
          onChange={(model) => setVersionDraft({ ...versionDraft, model })}
          options={MODELS.map((model) => ({ value: model, label: model }))}
        />
        {acceptsTemperature(versionDraft.model) && (
          <AppTextField
            label="Temperatura"
            type="number"
            value={versionDraft.temperature}
            onChange={(temperature) => setVersionDraft({ ...versionDraft, temperature })}
          />
        )}
        <AppTextField
          label="Máximo de tokens de saída"
          type="number"
          value={versionDraft.maxOutputTokens}
          onChange={(maxOutputTokens) => setVersionDraft({ ...versionDraft, maxOutputTokens })}
        />
        <AppSwitch
          label="Buscar na web"
          checked={versionDraft.webSearch}
          onChange={(webSearch) => setVersionDraft({ ...versionDraft, webSearch })}
        />
        <AppTextField
          label="Notas"
          value={versionDraft.notes}
          onChange={(notes) => setVersionDraft({ ...versionDraft, notes })}
          rows={2}
          maxRows={6}
        />
        <AppSwitch
          label="Ativar ao salvar"
          checked={versionDraft.activate}
          onChange={(activate) => setVersionDraft({ ...versionDraft, activate })}
        />
        <AppText variant="caption" tone="secondary">
          Ativar uma versão nova faz as respostas guardadas pela anterior serem regeneradas na
          próxima leitura. As antigas continuam no banco.
        </AppText>
      </AppFormDrawer>
    </AppStack>
  )
}
