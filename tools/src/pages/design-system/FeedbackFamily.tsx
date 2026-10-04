import {
  AppAlert,
  AppButton,
  AppCard,
  AppChip,
  AppEmptyState,
  AppProgressBar,
  AppSnackbar,
  AppStack,
  AppText,
  AppTooltip,
  useAppTheme,
  type AppChipProps,
  type AppSnackbarProps,
} from '@/components/ui'
import { useState } from 'react'
import { Entry, Matrix, State, States } from './Specimen'

type ChipTone = NonNullable<AppChipProps['tone']>
type SnackbarTone = AppSnackbarProps['tone']

const CHIP_TONES: readonly ChipTone[] = ['neutral', 'primary', 'info', 'success', 'caution', 'danger']
const CHIP_EMPHASES = ['solid', 'outline'] as const
const SNACKBAR_TONES: readonly SnackbarTone[] = ['success', 'info', 'danger']

const SNACKBAR_MESSAGE: Record<SnackbarTone, string> = {
  success: 'Carteira salva.',
  info: 'Importada, mas 3 linhas sem preço foram descartadas.',
  danger: 'Não foi possível salvar a carteira.',
}

function Snackbars() {
  const [open, setOpen] = useState<SnackbarTone | null>(null)
  return (
    <AppStack direction="row" gap="sm">
      {SNACKBAR_TONES.map((tone) => (
        <AppButton key={tone} emphasis="outline" size="sm" onClick={() => setOpen(tone)}>
          Mostrar {tone}
        </AppButton>
      ))}
      {open && (
        <AppSnackbar open tone={open} message={SNACKBAR_MESSAGE[open]} onClose={() => setOpen(null)} />
      )}
    </AppStack>
  )
}

export default function FeedbackFamily() {
  const theme = useAppTheme()

  return (
    <AppStack gap="lg">
      <Entry
        name="AppAlert"
        role="Aviso fixo no fluxo da página. danger para falha, info para estado vazio, success para o resultado de uma ação que fica na tela."
      >
        <AppStack gap="sm">
          <AppAlert tone="info">Nenhuma importação executada até agora.</AppAlert>
          <AppAlert tone="success">Posição recalculada.</AppAlert>
          <AppAlert tone="danger">A requisição falhou.</AppAlert>
        </AppStack>
      </Entry>

      <Entry
        name="AppSnackbar"
        role="Aviso que aparece no rodapé e some sozinho. Posição e tempo são do design system, não da tela que o dispara."
      >
        <Snackbars />
      </Entry>

      <Entry
        name="AppChip"
        role="Etiqueta curta de estado. outline para o que ainda não aconteceu — na fila, aguardando."
      >
        <Matrix
          label="tone × emphasis"
          rows={CHIP_TONES}
          cols={CHIP_EMPHASES}
          render={(tone, emphasis) => <AppChip label={tone} tone={tone} emphasis={emphasis} />}
        />
        <States label="tint · cor do dado, ignora o tom">
          {theme.palette.chart.colors.slice(0, 3).map((color, index) => (
            <AppChip key={color} label={`Categoria ${index + 1}`} tint={color} />
          ))}
        </States>
      </Entry>

      <Entry name="AppTooltip" role="O detalhe que não cabe na tela, ao passar o mouse.">
        <AppTooltip title="Preço sobre valor patrimonial da cota">
          <AppText variant="bodySmall">P/VP (passe o mouse)</AppText>
        </AppTooltip>
      </Entry>

      <Entry
        name="AppProgressBar"
        role="Quanto falta. Sem value, indeterminada: enfileirado, ainda sem número."
      >
        <AppStack gap="md">
          <State label="value=65">
            <AppProgressBar value={65} />
          </State>
          <State label="tone=danger · falhou">
            <AppProgressBar value={40} tone="danger" />
          </State>
          <State label="indeterminada">
            <AppProgressBar />
          </State>
          <State label="thickness=8">
            <AppProgressBar value={65} thickness={8} />
          </State>
          <State label="tone=golden · glow · a conquista">
            <AppProgressBar value={80} tone="golden" thickness={8} glow />
          </State>
        </AppStack>
      </Entry>

      <Entry
        name="AppEmptyState"
        role="O que a tela mostra quando não há o que mostrar, e o que fazer a respeito. O tamanho padrão, screen, ocupa 80% da altura da janela e por isso não tem amostra aqui: cresceria com ela."
      >
        <States>
          <State label="size=section">
            <AppCard>
              <AppEmptyState size="section" title="Nenhum ativo encontrado" description="Tente ajustar os filtros de busca" />
            </AppCard>
          </State>
          <State label="action">
            <AppCard>
              <AppEmptyState
                size="section"
                title="Sua carteira ainda está vazia"
                description="Comece cadastrando sua primeira compra"
                action={<AppButton>Registrar compra</AppButton>}
              />
            </AppCard>
          </State>
        </States>
      </Entry>
    </AppStack>
  )
}
