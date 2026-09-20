import { useEffect, useState } from 'react'

import {
  type AiArtifact,
  type AiFeatureForm,
  fetchAiFeatureForm,
  runAiFeature,
  scheduleAiFeature,
} from '@/api/ai'
import {
  AppAlert,
  AppButton,
  AppCard,
  AppMetric,
  AppStack,
  AppText,
  AppTextField,
  SectionLabel,
} from '@/components/ui'

/* Executar uma feature e ver a resposta, sem uma tela por feature.
 *
 * O formulário é montado a partir do JSON Schema que o backend publica em
 * `/ai/feature/{key}/form`, e o schema vem do modelo Pydantic declarado no
 * handler. É isso que faz uma feature nova ganhar tela sem uma linha escrita
 * aqui: o que muda entre uma feature e outra é a forma da entrada, e ela já é
 * declarada uma vez, do lado de lá. */

type Values = Record<string, string>

function coerce(values: Values, form: AiFeatureForm): Record<string, unknown> {
  const properties = form.input_schema.properties ?? {}
  return Object.fromEntries(
    Object.entries(values).map(([name, raw]) => {
      const type = properties[name]?.type
      if (type === 'integer' || type === 'number') {
        const parsed = Number(raw)
        return [name, Number.isNaN(parsed) ? raw : parsed]
      }
      if (type === 'boolean') return [name, raw === 'true']
      return [name, raw]
    }),
  )
}

export default function AiFeatureRunner({ featureKey }: { featureKey: string }) {
  const [form, setForm] = useState<AiFeatureForm | null>(null)
  const [values, setValues] = useState<Values>({})
  const [result, setResult] = useState<AiArtifact | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    let current = true
    setForm(null)
    setValues({})
    setResult(null)
    fetchAiFeatureForm(featureKey)
      .then((loaded) => current && setForm(loaded))
      .catch(() => current && setForm(null))
    return () => {
      current = false
    }
  }, [featureKey])

  const run = async () => {
    if (!form) return
    setRunning(true)
    setError(null)
    try {
      setResult(await runAiFeature(featureKey, coerce(values, form)))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Falha ao executar')
    } finally {
      setRunning(false)
    }
  }

  const schedule = async () => {
    setError(null)
    try {
      await scheduleAiFeature(featureKey)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Falha ao enfileirar')
    }
  }

  if (!form) return null

  const fields = Object.entries(form.input_schema.properties ?? {})

  return (
    <AppStack gap="md">
      <AppCard>
        <AppStack gap="md">
          <SectionLabel>Executar agora</SectionLabel>
          {fields.map(([name, schema]) => (
            <AppTextField
              key={name}
              label={schema.title ?? name}
              value={values[name] ?? ''}
              onChange={(next) => setValues((current) => ({ ...current, [name]: next }))}
              helperText={schema.description}
            />
          ))}
          <AppStack direction="row" gap="sm" wrap>
            <AppButton onClick={run} loading={running}>
              Executar e ver a resposta
            </AppButton>
            <AppButton emphasis="outline" onClick={schedule}>
              Rodar o agendamento no worker
            </AppButton>
          </AppStack>
          <AppText variant="caption" tone="secondary">
            Executar substitui a resposta guardada. Dados disponíveis ao prompt:{' '}
            {form.context_keys.join(', ')}
          </AppText>
        </AppStack>
      </AppCard>

      {error && <AppAlert severity="error">{error}</AppAlert>}

      {result && (
        <AppCard>
          <AppStack gap="md">
            <SectionLabel>Resposta</SectionLabel>
            <AppStack direction="row" gap="lg" wrap>
              <AppMetric label="Modelo" value={result.model} />
              <AppMetric label="Tokens de entrada" value={String(result.input_tokens)} />
              <AppMetric label="Tokens de saída" value={String(result.output_tokens)} />
              <AppMetric label="Custo (US$)" value={result.cost_usd.toFixed(4)} />
              <AppMetric label="Latência (ms)" value={String(result.latency_ms)} />
              <AppMetric label="Versão do prompt" value={String(result.prompt_version)} />
            </AppStack>
            <AppTextField
              label="Payload"
              value={JSON.stringify(result.payload, null, 2)}
              onChange={() => undefined}
              readOnly
              rows={12}
              maxRows={24}
              monospace
            />
          </AppStack>
        </AppCard>
      )}
    </AppStack>
  )
}
