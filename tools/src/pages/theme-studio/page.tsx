import {
  AppAlert,
  AppButton,
  AppCard,
  AppColorSwatch,
  AppConfirmDialog,
  AppListRow,
  AppSnackbar,
  AppStack,
  AppText,
  AppTextField,
  SectionLabel,
  SectionTitle,
} from '@/components/ui'
import { paletteContrastChecks } from '@/theme/contrast'
import { PRESET_FILE_ENDPOINT, type PresetFileChange } from '../../../server/preset-file'
import { presetSource } from '@/theme/preset-source'
import { THEME_PRESETS, type ThemePreset } from '@/theme/presets'
import { DEFAULT_LIGHT_THEME_ID } from '@/theme/themes'
import { useDeferredValue, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DevShell from '../DevShell'
import ContrastPanel from './ContrastPanel'
import ThemeStudioPreview from './ThemeStudioPreview'
import ThemeTokenForm from './ThemeTokenForm'

/* O estúdio de temas: parte de um preset, mexe nos tokens e vê o app mudar ao
 * vivo.
 *
 * O tema em edição pinta a casca inteira — barra do topo, coluna de
 * navegação, fundo e o próprio painel de controles —, e não um recorte
 * emoldurado: o que se vê é o app como ele vai ficar. O dashboard da carteira
 * ocupa o conteúdo como na página de verdade; os presets e os tokens ficam no
 * painel parado à direita, então a cor trocada e o efeito dela estão sempre
 * na tela ao mesmo tempo.
 *
 * A casca desenha o rascunho adiado (`useDeferredValue`): redesenhar o app é
 * caro, e assim um arraste no seletor de cor não espera por ele.
 *
 * Salvar grava em `src/theme/presets.ts`, pelo dev server (`preset-file.ts`):
 * "Salvar" reescreve o preset aberto, "Novo preset" acrescenta outro a partir
 * do rascunho. O commit do arquivo é o que publica o tema para todo usuário e
 * o põe sob os testes de contraste — por isso o estúdio não salva o que esses
 * testes reprovariam. Guardar no navegador seria um tema que só quem o fez
 * vê, e que nenhum teste olha.
 *
 * O id só se escolhe ao criar: ele fica no navegador de quem escolheu o tema,
 * e mudar o de um preset publicado troca o tema dessa pessoa pelo padrão. */

const MODES = [
  { mode: 'light', label: 'Claros' },
  { mode: 'dark', label: 'Escuros' },
] as const

async function savePresetFile(change: PresetFileChange) {
  const response = await fetch(PRESET_FILE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(change),
  })
  if (!response.ok) throw new Error((await response.text()) || `HTTP ${response.status}`)
}

const presetById = (id: string | null) =>
  THEME_PRESETS.find((preset) => preset.id === id) ??
  THEME_PRESETS.find((preset) => preset.id === DEFAULT_LIGHT_THEME_ID)!

export default function ThemeStudioPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const base = presetById(searchParams.get('preset'))
  const [draft, setDraft] = useState<ThemePreset>(() => structuredClone(base))
  const [creating, setCreating] = useState<{ id: string; name: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const choosePreset = (id: string) => {
    setSearchParams({ preset: id }, { replace: true })
    setDraft(structuredClone(presetById(id)))
  }

  const failing = paletteContrastChecks(draft.palette).filter(
    (check) => check.enforced && !(check.ratio != null && check.ratio >= check.min),
  )
  const preview = useDeferredValue(draft)
  const dirty = presetSource(draft) !== presetSource(base)
  const newIdTaken = creating != null && THEME_PRESETS.some((preset) => preset.id === creating.id)

  const save = async (change: PresetFileChange, message: string) => {
    setSaving(true)
    setSaveError(null)
    try {
      await savePresetFile(change)
      setSaved(message)
      return true
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error))
      return false
    } finally {
      setSaving(false)
    }
  }

  const saveCurrent = () =>
    save({ kind: 'update', id: base.id, source: presetSource(draft) }, `${draft.name} salvo em presets.ts.`)

  const createPreset = async () => {
    if (!creating) return
    const preset = { ...draft, id: creating.id, name: creating.name }
    const ok = await save(
      { kind: 'add', id: preset.id, name: preset.name, mode: preset.palette.mode, source: presetSource(preset) },
      `${preset.name} criado em presets.ts.`,
    )
    if (!ok) return
    setCreating(null)
    setDraft(preset)
    setSearchParams({ preset: preset.id }, { replace: true })
  }

  const panel = (
    <AppStack gap="lg">
      <AppStack gap="sm">
        <SectionTitle>Estúdio de temas</SectionTitle>
        {/* Nome e descrição no topo, e não numa aba: são o que se lê na
            lista de temas das Configurações. O id não está aqui — ele só se
            escolhe ao criar o preset. */}
        <AppTextField label="Nome" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
        <AppTextField
          label="Descrição"
          value={draft.description}
          onChange={(description) => setDraft({ ...draft, description })}
          rows={2}
          maxRows={4}
        />
        <AppStack direction="row" gap="sm" wrap>
          <AppButton onClick={saveCurrent} disabled={!dirty || failing.length > 0} loading={saving && !creating}>
            Salvar
          </AppButton>
          <AppButton
            emphasis="outline"
            disabled={failing.length > 0}
            onClick={() => setCreating({ id: '', name: draft.name })}
          >
            Novo preset
          </AppButton>
          <AppButton emphasis="ghost" disabled={!dirty} onClick={() => setDraft(structuredClone(base))}>
            Restaurar
          </AppButton>
        </AppStack>
        <AppText variant="caption" tone="secondary">
          {dirty ? `Alterações em ${base.name} ainda não salvas.` : `Editando ${base.name}.`}
        </AppText>
        {saveError && !creating && <AppAlert tone="danger">{saveError}</AppAlert>}
      </AppStack>

      {MODES.map(({ mode, label }) => (
        <AppStack key={mode} gap="xs">
          <SectionLabel>{label}</SectionLabel>
          {THEME_PRESETS.filter((preset) => preset.palette.mode === mode).map((preset) => (
            <AppListRow
              key={preset.id}
              padding="sm"
              selected={preset.id === base.id}
              onClick={() => choosePreset(preset.id)}
            >
              <AppStack direction="row" gap="sm" align="center">
                <AppColorSwatch color={preset.palette.primary} shape="dot" />
                <AppText variant="bodySmall" weight={preset.id === base.id ? 'strong' : 'regular'}>
                  {preset.name}
                </AppText>
              </AppStack>
            </AppListRow>
          ))}
        </AppStack>
      ))}

      {failing.length > 0 && (
        <AppAlert tone="danger">
          O teste de contraste reprova: {failing.map((check) => check.label.toLowerCase()).join(', ')}. Corrija
          antes de salvar.
        </AppAlert>
      )}

      <ThemeTokenForm draft={draft} onChange={setDraft} />
    </AppStack>
  )

  return (
    <DevShell theme={preview} aside={{ label: 'Presets e tokens do tema', content: panel }}>
      <AppStack gap="lg">
        <ThemeStudioPreview draft={preview} />

        <AppCard>
          <AppStack gap="sm">
            <SectionTitle>Contraste</SectionTitle>
            <ContrastPanel palette={draft.palette} />
          </AppStack>
        </AppCard>
      </AppStack>

      <AppConfirmDialog
        open={creating != null}
        title="Novo preset"
        tone="primary"
        confirmLabel="Criar preset"
        confirmDisabled={saving || !creating?.id || !creating.name || newIdTaken}
        onConfirm={() => void createPreset()}
        onCancel={() => {
          setCreating(null)
          setSaveError(null)
        }}
      >
        {creating && (
          <AppStack gap="md">
            <AppText variant="bodySmall">
              O rascunho atual vira um preset {draft.palette.mode === 'light' ? 'claro' : 'escuro'} novo em
              src/theme/presets.ts. {base.name} fica como está.
            </AppText>
            <AppTextField
              label="Id"
              value={creating.id}
              onChange={(id) => setCreating({ ...creating, id })}
              error={newIdTaken}
              helperText={
                newIdTaken
                  ? 'Já existe um preset com esse id.'
                  : 'Minúsculas, números e hífen, como nuvem-light. Não muda depois de publicado.'
              }
            />
            <AppTextField label="Nome" value={creating.name} onChange={(name) => setCreating({ ...creating, name })} />
            {saveError && <AppAlert tone="danger">{saveError}</AppAlert>}
          </AppStack>
        )}
      </AppConfirmDialog>

      <AppSnackbar open={saved != null} message={saved ?? ''} tone="success" onClose={() => setSaved(null)} />
    </DevShell>
  )
}
