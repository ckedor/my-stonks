import {
  AppAlert,
  AppButton,
  AppCard,
  AppCopyField,
  AppDialog,
  AppPageHeader,
  AppSelect,
  AppStack,
  AppText,
  SectionTitle,
} from '@/components/ui'
import { paletteContrastChecks } from '@/theme/contrast'
import { presetSource } from '@/theme/preset-source'
import { THEME_PRESETS, type ThemePreset } from '@/theme/presets'
import { DEFAULT_LIGHT_THEME_ID } from '@/theme/themes'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ContrastPanel from './ContrastPanel'
import ThemeStudioPreview from './ThemeStudioPreview'
import ThemeTokenForm from './ThemeTokenForm'

/* O estúdio de temas: parte de um preset, mexe nos tokens e vê o dashboard
 * da carteira mudar ao vivo.
 *
 * Não guarda nada. Um tema vira preset quando a definição exportada daqui é
 * colada em `src/theme/presets.ts` e commitada — é o que o publica para todo
 * usuário e o que o põe sob os testes de contraste. Guardar no navegador
 * seria um tema que só quem o fez vê, e que nenhum teste olha. */

const PRESET_OPTIONS = THEME_PRESETS.map((preset) => ({
  value: preset.id,
  label: `${preset.name} (${preset.palette.mode === 'light' ? 'claro' : 'escuro'})`,
}))

const presetById = (id: string | null) =>
  THEME_PRESETS.find((preset) => preset.id === id) ??
  THEME_PRESETS.find((preset) => preset.id === DEFAULT_LIGHT_THEME_ID)!

export default function ThemeStudioPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const base = presetById(searchParams.get('preset'))
  const [draft, setDraft] = useState<ThemePreset>(() => structuredClone(base))
  const [exporting, setExporting] = useState(false)

  const choosePreset = (id: string) => {
    setSearchParams({ preset: id }, { replace: true })
    setDraft(structuredClone(presetById(id)))
  }

  const failing = paletteContrastChecks(draft.palette).filter(
    (check) => check.enforced && !(check.ratio != null && check.ratio >= check.min),
  )
  const replacesPreset = THEME_PRESETS.some((preset) => preset.id === draft.id)

  return (
    <AppStack gap="lg">
      <AppPageHeader
        title="Estúdio de temas"
        description="Parta de um preset, ajuste cores, fontes, raios e superfícies, e veja o dashboard da carteira mudar. Exporte o preset para publicá-lo em src/theme/presets.ts."
        actions={
          <AppStack direction="row" gap="sm" align="center" wrap>
            <AppSelect
              label="Preset de base"
              size="md"
              options={PRESET_OPTIONS}
              value={base.id}
              onChange={choosePreset}
            />
            <AppButton emphasis="ghost" onClick={() => setDraft(structuredClone(base))}>
              Restaurar
            </AppButton>
            <AppButton onClick={() => setExporting(true)}>Exportar preset</AppButton>
          </AppStack>
        }
      />

      <AppCard>
        <ThemeTokenForm draft={draft} onChange={setDraft} />
      </AppCard>

      <AppCard>
        <AppStack gap="sm">
          <SectionTitle>Contraste</SectionTitle>
          <ContrastPanel palette={draft.palette} />
        </AppStack>
      </AppCard>

      <AppStack gap="sm">
        <SectionTitle>Dashboard da carteira</SectionTitle>
        <ThemeStudioPreview draft={draft} />
      </AppStack>

      {exporting && (
        <AppDialog open title="Exportar preset" onClose={() => setExporting(false)}>
          <AppStack gap="md">
            <AppText variant="bodySmall">
              {replacesPreset
                ? `Substitua o preset "${draft.id}" em src/theme/presets.ts por esta definição e commite.`
                : 'Cole esta definição em src/theme/presets.ts, ponha a constante em THEME_PRESETS e commite.'}
            </AppText>
            {failing.length > 0 && (
              <AppAlert tone="danger">
                O teste de contraste vai reprovar: {failing.map((check) => check.label.toLowerCase()).join(', ')}.
              </AppAlert>
            )}
            <AppCopyField label="Definição" value={presetSource(draft)} multiline />
          </AppStack>
        </AppDialog>
      )}
    </AppStack>
  )
}
