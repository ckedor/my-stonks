import {
  AppAlert,
  AppButton,
  AppCard,
  AppChip,
  AppColorSwatch,
  AppDivider,
  AppGrid,
  AppProgressBar,
  AppSimpleTable,
  AppStack,
  AppStatCard,
  AppText,
  AppTooltip,
  SectionTitle,
  useAppTheme,
} from '@/components/ui'

/* O catálogo dos primitivos de `@/components/ui`, que é o que as telas têm
 * permissão de usar. Escrito sem nenhum import do MUI, de propósito: esta
 * página é o exemplo de como uma tela se escreve hoje.
 *
 * O inventário de MUI cru que morava aqui foi apagado junto com a migração
 * que esvaziou o `eslint-ds-baseline.json`: ele documentava a camada que
 * nenhuma tela pode mais tocar. */

/** Uma cor do tema com o nome dela embaixo. */
function PaletteEntry({ color, label }: { color: string; label: string }) {
  return (
    <AppStack gap="xs" align="center">
      <AppColorSwatch color={color} shape="large" />
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
    </AppStack>
  )
}

export default function GeneralTab() {
  const theme = useAppTheme()

  return (
    <AppStack gap="xl">
      {/* ── Paleta ── */}
      <AppCard>
        <AppStack gap="md">
          <SectionTitle>Paleta</SectionTitle>
          <AppStack direction="row" gap="md" wrap>
            <PaletteEntry color={theme.palette.primary.main} label="Primary" />
            <PaletteEntry color={theme.palette.secondary.main} label="Secondary" />
            <PaletteEntry color={theme.palette.error.main} label="Error" />
            <PaletteEntry color={theme.palette.warning.main} label="Warning" />
            <PaletteEntry color={theme.palette.success.main} label="Success" />
            <PaletteEntry color={theme.palette.info.main} label="Info" />
            <PaletteEntry color={theme.palette.golden} label="Golden" />
            <PaletteEntry color={theme.palette.background.default} label="Bg Default" />
            <PaletteEntry color={theme.palette.background.paper} label="Bg Paper" />
            <PaletteEntry color={theme.palette.text.primary} label="Text Primary" />
            <PaletteEntry color={theme.palette.text.secondary} label="Text Sec." />
            <PaletteEntry color={theme.palette.divider} label="Divider" />
          </AppStack>

          <AppStack gap="sm">
            <AppText variant="bodySmall" tone="secondary">
              Cores de série dos gráficos, na ordem em que são consumidas
            </AppText>
            <AppStack direction="row" gap="md" wrap>
              {theme.palette.chart.colors.map((color, i) => (
                <PaletteEntry key={color} color={color} label={`${i + 1}`} />
              ))}
            </AppStack>
          </AppStack>
        </AppStack>
      </AppCard>

      {/* ── Tipografia ── */}
      <AppCard>
        <AppStack gap="md">
          <SectionTitle>Tipografia</SectionTitle>
          <AppText variant="bodySmall" tone="secondary">
            Os nomes do AppText são semânticos: a tela pede `bodySmall` porque
            aquilo é um texto de apoio, não porque quer 14px.
          </AppText>
          <AppGrid cols={{ xs: 1, md: 2 }} gap="md">
            <AppStack gap="xs">
              <AppText variant="display">display — a frase que recebe quem chega</AppText>
              <AppText variant="pageHeading">pageHeading — o assunto da tela</AppText>
              <AppText variant="cardValue">cardValue — o número de um card</AppText>
            </AppStack>
            <AppStack gap="xs">
              <AppText>body — the quick brown fox jumps over the lazy dog</AppText>
              <AppText variant="bodySmall">bodySmall — the quick brown fox</AppText>
              <AppText variant="caption" tone="secondary">caption · secondary</AppText>
            </AppStack>
          </AppGrid>
        </AppStack>
      </AppCard>

      <AppCard>
        <AppStack gap="lg">
          <SectionTitle>Design system — primitivos</SectionTitle>

          <AppStack gap="sm">
            <AppText variant="bodySmall" tone="secondary">
              AppButton — tone (intenção) × emphasis (peso)
            </AppText>
            <AppStack direction="row" gap="sm" wrap>
              <AppButton>primary · solid</AppButton>
              <AppButton emphasis="outline">primary · outline</AppButton>
              <AppButton emphasis="ghost">primary · ghost</AppButton>
              <AppButton tone="danger">danger · solid</AppButton>
              <AppButton tone="danger" emphasis="outline">danger · outline</AppButton>
              <AppButton tone="caution" emphasis="outline">caution · outline</AppButton>
              <AppButton disabled>disabled</AppButton>
            </AppStack>
          </AppStack>

          <AppStack gap="sm">
            <AppText variant="bodySmall" tone="secondary">
              AppChip — mesmos dois eixos
            </AppText>
            <AppStack direction="row" gap="sm" wrap align="center">
              <AppChip label="neutral" />
              <AppChip label="primary" tone="primary" />
              <AppChip label="info" tone="info" />
              <AppChip label="success" tone="success" />
              <AppChip label="caution" tone="caution" />
              <AppChip label="danger" tone="danger" />
              <AppChip label="neutral · outline" emphasis="outline" />
              <AppTooltip title="AppTooltip — o detalhe que não cabe na tela">
                <AppChip label="passe o mouse" tone="info" emphasis="outline" />
              </AppTooltip>
            </AppStack>
          </AppStack>

          <AppStack gap="sm">
            <AppText variant="bodySmall" tone="secondary">
              AppText — variant × tone × weight
            </AppText>
            <AppText>body — the quick brown fox</AppText>
            <AppText variant="bodySmall">bodySmall — the quick brown fox</AppText>
            <AppText variant="bodySmall" weight="strong">bodySmall · strong</AppText>
            <AppText variant="bodySmall" tone="secondary">bodySmall · secondary</AppText>
            <AppText variant="bodySmall" tone="danger">bodySmall · danger</AppText>
            <AppText variant="caption" tone="secondary">caption · secondary</AppText>
          </AppStack>

          <AppDivider />

          <AppStack gap="sm">
            <AppText variant="bodySmall" tone="secondary">
              AppStatCard — uma fileira de tiles de um número só
            </AppText>
            <AppStack direction="row" gap="md" wrap collapseBelow="sm">
              <AppStatCard label="Processados" value="120/120" helper="Histórico completo" />
              <AppStatCard label="Sucessos" value={117} helper="4.310 linhas persistidas" />
              <AppStatCard label="Falhas" value={3} helper="Consulte as tentativas" />
            </AppStack>
          </AppStack>

          <AppStack gap="sm">
            <AppText variant="bodySmall" tone="secondary">
              AppProgressBar — determinada e indeterminada
            </AppText>
            <AppProgressBar value={65} />
            <AppProgressBar value={40} tone="danger" />
            <AppProgressBar />
          </AppStack>

          <AppStack gap="sm">
            <AppText variant="bodySmall" tone="secondary">
              AppAlert — fixo no fluxo, diferente do snackbar
            </AppText>
            <AppAlert severity="success">success — a ação que você disparou deu certo.</AppAlert>
            <AppAlert severity="info">info — não há nada para mostrar aqui ainda.</AppAlert>
            <AppAlert severity="error">error — a requisição falhou.</AppAlert>
          </AppStack>

          <AppStack gap="sm">
            <AppText variant="bodySmall" tone="secondary">
              AppSimpleTable — cabeçalho e linhas, sem paginação nem ordenação
            </AppText>
            <AppSimpleTable
              rows={SAMPLE_ROWS}
              getRowKey={(row) => row.id}
              surface="outlined"
              columns={[
                { label: 'ID', render: (row) => `#${row.id}` },
                {
                  label: 'Status',
                  render: (row) => <AppChip label={row.label} tone={row.tone} />,
                },
                { label: 'Detalhe', width: 'clamped', render: (row) => row.detail },
                { label: 'Linhas', align: 'right', render: (row) => row.rows },
              ]}
            />
          </AppStack>
        </AppStack>
      </AppCard>
    </AppStack>
  )
}

const SAMPLE_ROWS = [
  {
    id: 7,
    label: 'Sucesso',
    tone: 'success' as const,
    detail: 'Um texto longo o bastante para a coluna clamped cortar com reticências',
    rows: 4310,
  },
  { id: 6, label: 'Falha', tone: 'danger' as const, detail: 'timeout no provedor', rows: 0 },
  { id: 5, label: 'Na fila', tone: 'neutral' as const, detail: '—', rows: 0 },
]
