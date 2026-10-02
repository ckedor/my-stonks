import {
  AppGrid,
  AppHexColorField,
  AppNumberField,
  AppSelect,
  AppStack,
  AppSwitch,
  AppTabs,
  AppTextField,
  SectionLabel,
} from '@/components/ui'
import type { ThemePreset } from '@/theme/presets'
import { fontStackKey, type FontStackKey } from '@/theme/preset-source'
import type { ThemePaletteConfig } from '@/theme/themes'
import { fontStacks, type RadiusToken } from '@/theme/tokens'
import { useState, type ReactNode } from 'react'

/* Os tokens de um tema, editáveis: cores, séries de gráfico, forma e
 * identidade. Cada campo escreve direto no preset em edição — a amostra ao
 * lado redesenha a cada mudança. */

type Tab = 'cores' | 'grafico' | 'forma' | 'identidade'

const TABS = [
  { id: 'cores' as const, label: 'Cores' },
  { id: 'grafico' as const, label: 'Gráfico' },
  { id: 'forma' as const, label: 'Forma' },
  { id: 'identidade' as const, label: 'Identidade' },
]

/* Um nome por pilha. O `Record` é o que faz a pilha nova em `fontStacks`
   chegar aqui com o nome dela, em vez de aparecer como chave crua. */
const FONT_LABEL: Record<FontStackKey, string> = {
  grotesk: 'Hanken Grotesk',
  figtree: 'Figtree',
  sourceSerif: 'Source Serif 4 (serifa)',
  jetbrainsMono: 'JetBrains Mono (mono)',
  pixelifySans: 'Pixelify Sans (bitmap)',
}

const FONT_OPTIONS = (Object.keys(fontStacks) as FontStackKey[]).map((key) => ({
  value: key,
  label: FONT_LABEL[key],
}))

const RADIUS_TOKENS: { token: Exclude<RadiusToken, 'pill'>; label: string }[] = [
  { token: 'sm', label: 'Raio pequeno (campo, chip)' },
  { token: 'md', label: 'Raio do card' },
  { token: 'lg', label: 'Raio do botão' },
]

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <AppStack gap="sm">
      <SectionLabel>{label}</SectionLabel>
      <AppGrid cols={{ xs: 1, sm: 2, lg: 4 }} gap="md">
        {children}
      </AppGrid>
    </AppStack>
  )
}

export default function ThemeTokenForm({
  draft,
  onChange,
}: {
  draft: ThemePreset
  onChange: (draft: ThemePreset) => void
}) {
  const [tab, setTab] = useState<Tab>('cores')
  const { palette, shape } = draft

  const setPalette = (patch: Partial<ThemePaletteConfig>) =>
    onChange({ ...draft, palette: { ...palette, ...patch } })
  const color = (label: string, value: string, apply: (value: string) => void) => (
    <AppHexColorField key={label} label={label} value={value} onChange={apply} />
  )

  return (
    <AppStack gap="md">
      <AppTabs items={TABS} value={tab} onChange={setTab} label="Tokens do tema" />

      {tab === 'cores' && (
        <AppStack gap="lg">
          <Group label="Superfície e texto">
            {color('Fundo da página', palette.background.default, (v) => setPalette({ background: { ...palette.background, default: v } }))}
            {color('Card', palette.background.paper, (v) => setPalette({ background: { ...palette.background, paper: v } }))}
            {color('Texto', palette.text.primary, (v) => setPalette({ text: { ...palette.text, primary: v } }))}
            {color('Texto de apoio', palette.text.secondary, (v) => setPalette({ text: { ...palette.text, secondary: v } }))}
            {color('Divisor', palette.divider, (v) => setPalette({ divider: v }))}
            {color('Escuro', palette.dark, (v) => setPalette({ dark: v }))}
          </Group>
          <Group label="Intenção">
            {color('Primária (linha da carteira)', palette.primary, (v) => setPalette({ primary: v }))}
            {color('Secundária', palette.secondary, (v) => setPalette({ secondary: v }))}
            {color('Positivo', palette.success, (v) => setPalette({ success: v }))}
            {color('Negativo', palette.error, (v) => setPalette({ error: v }))}
            {color('Alerta (linha do benchmark)', palette.warning, (v) => setPalette({ warning: v }))}
            {color('Info', palette.info, (v) => setPalette({ info: v }))}
            {color('Dourado (conquista)', palette.golden, (v) => setPalette({ golden: v }))}
          </Group>
          <Group label="Barra do topo e menu">
            {color('Fundo da barra', palette.topbar.background, (v) => setPalette({ topbar: { ...palette.topbar, background: v } }))}
            {color('Texto da barra', palette.topbar.text, (v) => setPalette({ topbar: { ...palette.topbar, text: v } }))}
            {color('Aba ativa: texto', palette.topbar.activeText, (v) => setPalette({ topbar: { ...palette.topbar, activeText: v } }))}
            {color('Aba ativa: fundo', palette.topbar.activeBg, (v) => setPalette({ topbar: { ...palette.topbar, activeBg: v } }))}
            {color('Menu lateral', palette.sidebar, (v) => setPalette({ sidebar: v }))}
          </Group>
        </AppStack>
      )}

      {tab === 'grafico' && (
        <AppStack gap="lg">
          <Group label="Eixos">
            {color('Grade', palette.chart.grid, (v) => setPalette({ chart: { ...palette.chart, grid: v } }))}
            {color('Rótulo', palette.chart.label, (v) => setPalette({ chart: { ...palette.chart, label: v } }))}
          </Group>
          <Group label="Séries, na ordem em que são consumidas — nenhuma repete a primária nem a secundária">
            {palette.chart.colors.map((value, index) =>
              color(`Série ${index + 1}`, value, (v) => {
                const colors = [...palette.chart.colors]
                colors[index] = v
                setPalette({ chart: { ...palette.chart, colors } })
              }),
            )}
          </Group>
        </AppStack>
      )}

      {tab === 'forma' && (
        <AppStack gap="lg">
          <Group label="Fonte">
            <AppSelect
              label="Corpo"
              size="full"
              density="comfortable"
              options={FONT_OPTIONS}
              value={fontStackKey(shape.fontFamily)}
              onChange={(key) => onChange({ ...draft, shape: { ...shape, fontFamily: fontStacks[key as FontStackKey] } })}
            />
            <AppSelect
              label="Títulos"
              size="full"
              density="comfortable"
              options={FONT_OPTIONS}
              value={fontStackKey(shape.headingFontFamily)}
              onChange={(key) =>
                onChange({ ...draft, shape: { ...shape, headingFontFamily: fontStacks[key as FontStackKey] } })
              }
            />
          </Group>
          <Group label="Raio, em px">
            {RADIUS_TOKENS.map(({ token, label }) => (
              <AppNumberField
                key={token}
                label={label}
                size="full"
                density="comfortable"
                suffix="px"
                value={shape.radius[token]}
                onChange={(value) => onChange({ ...draft, shape: { ...shape, radius: { ...shape.radius, [token]: value } } })}
              />
            ))}
          </Group>
          <AppSwitch
            label="Superfícies quietas"
            description="Card desenhado por borda e não por sombra, botão sem sombra, campo com a borda do divisor e números em colunas tabulares."
            checked={Boolean(shape.quiet)}
            onChange={(quiet) => onChange({ ...draft, shape: { ...shape, quiet } })}
          />
        </AppStack>
      )}

      {tab === 'identidade' && (
        <AppStack gap="md">
          <AppGrid cols={{ xs: 1, md: 2 }} gap="md">
            <AppTextField label="Id" value={draft.id} onChange={(id) => onChange({ ...draft, id })} density="comfortable" helperText="Fica no navegador de quem escolhe o tema: não mude o de um preset publicado." />
            <AppTextField label="Nome" value={draft.name} onChange={(name) => onChange({ ...draft, name })} density="comfortable" />
          </AppGrid>
          <AppTextField
            label="Descrição"
            value={draft.description}
            onChange={(description) => onChange({ ...draft, description })}
            density="comfortable"
          />
        </AppStack>
      )}
    </AppStack>
  )
}
