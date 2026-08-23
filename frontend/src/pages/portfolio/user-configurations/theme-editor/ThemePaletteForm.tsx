import { AppGrid, AppGridItem, AppHexColorField, AppStack, SectionTitle } from '@/components/ui'
import type { ThemePaletteConfig } from '@/theme/themes'

interface Props {
  config: ThemePaletteConfig
  onChange: (config: ThemePaletteConfig) => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <AppStack gap="sm">
      <SectionTitle>{title}</SectionTitle>
      <AppGrid cols={{ xs: 1, sm: 2 }} gap="md">
        {children}
      </AppGrid>
    </AppStack>
  )
}

export default function ThemePaletteForm({ config, onChange }: Props) {
  const set = <K extends keyof ThemePaletteConfig>(key: K, value: ThemePaletteConfig[K]) =>
    onChange({ ...config, [key]: value })

  const setNested = <
    K extends keyof ThemePaletteConfig,
    NK extends keyof Extract<ThemePaletteConfig[K], object>,
  >(
    key: K,
    nestedKey: NK,
    value: string,
  ) => {
    const parent = config[key] as Record<string, string>
    onChange({ ...config, [key]: { ...parent, [nestedKey]: value } })
  }

  const setChartColor = (index: number, value: string) => {
    const colors = [...config.chart.colors]
    colors[index] = value
    onChange({ ...config, chart: { ...config.chart, colors } })
  }

  return (
    <AppStack gap="lg">
      <Section title="Fundo">
        <AppHexColorField
          label="Background"
          value={config.background.default}
          onChange={(v) => setNested('background', 'default' as never, v)}
        />
        <AppHexColorField
          label="Paper (Cards)"
          value={config.background.paper}
          onChange={(v) => setNested('background', 'paper' as never, v)}
        />
      </Section>

      <Section title="Texto">
        <AppHexColorField
          label="Primário"
          value={config.text.primary}
          onChange={(v) => setNested('text', 'primary' as never, v)}
        />
        <AppHexColorField
          label="Secundário"
          value={config.text.secondary}
          onChange={(v) => setNested('text', 'secondary' as never, v)}
        />
      </Section>

      <Section title="Cores Principais">
        <AppHexColorField label="Primary" value={config.primary} onChange={(v) => set('primary', v)} />
        <AppHexColorField
          label="Secondary"
          value={config.secondary}
          onChange={(v) => set('secondary', v)}
        />
        <AppHexColorField label="Golden" value={config.golden} onChange={(v) => set('golden', v)} />
        <AppHexColorField label="Dark" value={config.dark} onChange={(v) => set('dark', v)} />
      </Section>

      <Section title="Status">
        <AppHexColorField label="Sucesso" value={config.success} onChange={(v) => set('success', v)} />
        <AppHexColorField label="Erro" value={config.error} onChange={(v) => set('error', v)} />
        <AppHexColorField label="Aviso" value={config.warning} onChange={(v) => set('warning', v)} />
        <AppHexColorField label="Info" value={config.info} onChange={(v) => set('info', v)} />
      </Section>

      <Section title="Layout (Sidebar / Topbar)">
        <AppHexColorField label="Sidebar" value={config.sidebar} onChange={(v) => set('sidebar', v)} />
        <AppHexColorField
          label="Topbar Fundo"
          value={config.topbar.background}
          onChange={(v) => setNested('topbar', 'background' as never, v)}
        />
        <AppHexColorField
          label="Topbar Texto"
          value={config.topbar.text}
          onChange={(v) => setNested('topbar', 'text' as never, v)}
        />
        <AppHexColorField label="Divider" value={config.divider} onChange={(v) => set('divider', v)} />
      </Section>

      <Section title="Gráficos">
        <AppHexColorField
          label="Grid"
          value={config.chart.grid}
          onChange={(v) => onChange({ ...config, chart: { ...config.chart, grid: v } })}
        />
        <AppHexColorField
          label="Label"
          value={config.chart.label}
          onChange={(v) => onChange({ ...config, chart: { ...config.chart, label: v } })}
        />
        {/* As cores de série são muitas e curtas: cabem em quatro colunas onde
            os campos nomeados cabem em duas. */}
        <AppGridItem span={{ xs: 1, sm: 2 }}>
          <AppGrid cols={{ xs: 2, sm: 3, md: 4 }} gap="md">
            {config.chart.colors.map((color, i) => (
              <AppHexColorField
                key={i}
                label={`Cor ${i + 1}`}
                value={color}
                onChange={(v) => setChartColor(i, v)}
              />
            ))}
          </AppGrid>
        </AppGridItem>
      </Section>
    </AppStack>
  )
}
