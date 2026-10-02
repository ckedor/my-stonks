import {
  AppButton,
  AppCard,
  AppConfirmDialog,
  AppCrudForm,
  AppDialog,
  AppFloatingCard,
  AppFormDrawer,
  AppGrid,
  AppListRow,
  AppSideDrawer,
  AppStack,
  AppText,
  AppTextField,
  AppThemePreview,
  useAppTheme,
  type AppCardProps,
  type AppConfirmDialogProps,
  type FieldConfig,
} from '@/components/ui'
import { DEFAULT_DARK_THEME_ID, DEFAULT_LIGHT_THEME_ID, getThemeById } from '@/theme/themes'
import { useState, type ReactNode } from 'react'
import { Entry, State, States } from './Specimen'

type ConfirmTone = NonNullable<AppConfirmDialogProps['tone']>

const CRUD_FIELDS: FieldConfig[] = [
  { name: 'name', label: 'Nome', type: 'text', required: true },
  {
    name: 'currency',
    label: 'Moeda',
    type: 'select',
    options: [
      { value: 'BRL', label: 'Real' },
      { value: 'USD', label: 'Dólar' },
    ],
  },
]

/** Uma amostra de card com o nome do estado dentro. */
function CardSample({ label, ...props }: Omit<AppCardProps, 'children'> & { label: string }) {
  return (
    <AppCard {...props}>
      <AppText variant="bodySmall">{label}</AppText>
    </AppCard>
  )
}

/** Um botão que abre a sobreposição que ele nomeia. */
function Opener({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <AppButton emphasis="outline" onClick={() => setOpen(true)}>
        {label}
      </AppButton>
      {open && children(() => setOpen(false))}
    </>
  )
}

function FormDrawerBody() {
  const [name, setName] = useState('Principal')
  return <AppTextField label="Nome" value={name} onChange={setName} density="comfortable" />
}

export default function SurfacesFamily() {
  const theme = useAppTheme()
  const accent = theme.palette.chart.colors[0]
  const light = getThemeById(DEFAULT_LIGHT_THEME_ID)
  const dark = getThemeById(DEFAULT_DARK_THEME_ID)

  return (
    <AppStack gap="lg">
      <Entry
        name="AppCard"
        role="A superfície padrão: fundo, borda e raio do tema. Se falta algo, a prop entra aqui — o sx dele é saída de emergência com prazo."
      >
        <States label="padding">
          {(['none', 'sm', 'md', 'lg'] as const).map((padding) => (
            <CardSample key={padding} label={padding} padding={padding} />
          ))}
        </States>
        <AppGrid cols={{ xs: 1, md: 4 }} gap="md">
          <CardSample label="raised · flutua sobre o conteúdo" raised />
          <CardSample label="interactive · leva a algum lugar" interactive onClick={() => undefined} />
          <CardSample label="interactive · accentColor no hover" interactive accentColor={accent} onClick={() => undefined} />
          <CardSample label="selected · o escolhido entre vários" selected />
          <CardSample label="dashed · o que ainda não é nada" dashed />
          <CardSample label="accentEdge · top" accentEdge={accent} />
          <CardSample label="accentEdge · left" accentEdge={accent} accentSide="left" />
          <CardSample label="tint · destaque dentro de um card maior" tint={accent} />
        </AppGrid>
      </Entry>

      <Entry
        name="AppFloatingCard"
        role="O balão sobre um gráfico, na posição que quem desenha calcula. Não rouba o cursor."
      >
        <AppCard height={140} padding="none">
          <AppStack anchor>
            <AppFloatingCard left={24} top={24} width={220}>
              <AppText variant="caption" tone="secondary">
                17/03/2026
              </AppText>
              <AppText variant="bodySmall" weight="strong">
                R$ 31.790,00
              </AppText>
            </AppFloatingCard>
          </AppStack>
        </AppCard>
      </Entry>

      <Entry
        name="AppDialog + AppConfirmDialog"
        role="AppDialog avisa e só tem o botão de fechar. AppConfirmDialog pergunta: cancelar à esquerda, confirmar à direita, no tom da ação."
      >
        <States>
          <State label="AppDialog">
            <Opener label="Abrir aviso">
              {(close) => (
                <AppDialog open title="Bônus de dividendos" onClose={close}>
                  <AppText variant="bodySmall">O prédio cresce um andar a cada R$ 100 recebidos.</AppText>
                </AppDialog>
              )}
            </Opener>
          </State>
          {(['danger', 'caution', 'primary'] as ConfirmTone[]).map((tone) => (
            <State key={tone} label={`AppConfirmDialog · ${tone}`}>
              <Opener label={`Confirmar ${tone}`}>
                {(close) => (
                  <AppConfirmDialog
                    open
                    tone={tone}
                    title="Excluir carteira?"
                    confirmLabel="Excluir"
                    onConfirm={close}
                    onCancel={close}
                  >
                    As posições e o histórico dela deixam de aparecer.
                  </AppConfirmDialog>
                )}
              </Opener>
            </State>
          ))}
        </States>
      </Entry>

      <Entry
        name="AppSideDrawer + AppFormDrawer + AppCrudForm"
        role="Os três painéis laterais. AppSideDrawer é de leitura e escolha, sem rodapé; AppFormDrawer submete, com o botão preso embaixo; AppCrudForm monta os campos sozinho a partir de uma lista, para o CRUD do admin."
      >
        <States>
          <State label="AppSideDrawer">
            <Opener label="Abrir painel">
              {(close) => (
                <AppSideDrawer open onClose={close} title="Escolher ativo" width="sm">
                  {['PETR4', 'HGLG11', 'BOVA11'].map((ticker) => (
                    <AppListRow key={ticker} onClick={close}>
                      <AppText variant="bodySmall">{ticker}</AppText>
                    </AppListRow>
                  ))}
                </AppSideDrawer>
              )}
            </Opener>
          </State>
          <State label="AppFormDrawer · onDelete">
            <Opener label="Abrir formulário">
              {(close) => (
                <AppFormDrawer
                  open
                  onClose={close}
                  title="Editar carteira"
                  width="sm"
                  submitLabel="Salvar"
                  onSubmit={close}
                  onDelete={close}
                >
                  <FormDrawerBody />
                </AppFormDrawer>
              )}
            </Opener>
          </State>
          <State label="AppFormDrawer · submitting">
            <Opener label="Abrir enviando">
              {(close) => (
                <AppFormDrawer open onClose={close} title="Nova carteira" width="sm" submitLabel="Salvando" onSubmit={close} submitting>
                  <FormDrawerBody />
                </AppFormDrawer>
              )}
            </Opener>
          </State>
          <State label="AppCrudForm">
            <Opener label="Abrir CRUD">
              {(close) => (
                <AppCrudForm
                  open
                  onClose={close}
                  onSave={async () => close()}
                  title="Nova corretora"
                  fields={CRUD_FIELDS}
                />
              )}
            </Opener>
          </State>
        </States>
      </Entry>

      <Entry name="AppThemePreview" role="A miniatura de um tema, desenhada com as cores dele — a grade de temas das configurações.">
        <AppGrid cols={{ xs: 1, md: 4 }} gap="md">
          {[light, dark].map(
            (definition) =>
              definition && (
                <State key={definition.id} label={definition.name}>
                  <AppThemePreview colors={definition.preview} sampleTheme={definition.theme} />
                </State>
              ),
          )}
        </AppGrid>
      </Entry>
    </AppStack>
  )
}
