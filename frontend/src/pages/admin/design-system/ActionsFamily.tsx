import {
  AppButton,
  AppIconButton,
  AppIconLink,
  AppMenu,
  AppMenuButton,
  AppStack,
  ThemeToggleButton,
  type AppButtonProps,
  type AppMenuOption,
} from '@/components/ui'
import AddIcon from '@mui/icons-material/Add'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import SettingsIcon from '@mui/icons-material/Settings'
import { useState, type MouseEvent } from 'react'
import { Entry, Matrix, State, States } from './Specimen'

type Tone = NonNullable<AppButtonProps['tone']>
type Emphasis = NonNullable<AppButtonProps['emphasis']>

const TONES: readonly Tone[] = ['primary', 'danger', 'caution']
const EMPHASES: readonly Emphasis[] = ['solid', 'outline', 'ghost']

const MENU_OPTIONS: AppMenuOption[] = [
  { label: 'Configurações', icon: <SettingsIcon fontSize="small" />, onSelect: () => undefined },
  { label: 'Tema escuro', icon: <DarkModeIcon fontSize="small" />, iconTone: 'golden', onSelect: () => undefined },
  { label: 'Somente leitura', disabled: true },
]

/** Um gatilho e o menu que ele abre, com o estado de aberto aqui dentro. */
function MenuSample({ placement }: { placement: 'below' | 'beside' }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const open = (event: MouseEvent<HTMLElement>) => setAnchor(event.currentTarget)

  return (
    <>
      <AppMenuButton open={Boolean(anchor)} onClick={open}>
        {placement === 'below' ? 'Carteira' : 'Submenu'}
      </AppMenuButton>
      <AppMenu
        id={`catalog-menu-${placement}`}
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        options={MENU_OPTIONS}
        placement={placement}
      />
    </>
  )
}

export default function ActionsFamily() {
  return (
    <AppStack gap="lg">
      <Entry
        name="AppButton"
        role="A ação com rótulo. tone diz do que se trata, emphasis quanto puxa o olho — dois eixos, e nenhuma combinação nova fora deles."
      >
        <Matrix
          label="tone × emphasis"
          rows={TONES}
          cols={EMPHASES}
          render={(tone, emphasis) => (
            <AppButton tone={tone} emphasis={emphasis}>
              {tone}
            </AppButton>
          )}
        />
        <States label="Tamanho">
          {(['sm', 'md', 'lg'] as const).map((size) => (
            <State key={size} label={size}>
              <AppButton size={size}>Salvar</AppButton>
            </State>
          ))}
        </States>
        <States label="Estado">
          <State label="icon">
            <AppButton icon={<AddIcon />}>Nova carteira</AppButton>
          </State>
          <State label="loading · mantém o rótulo">
            <AppButton icon={<AddIcon />} loading>
              Salvando
            </AppButton>
          </State>
          <State label="disabled">
            <AppButton disabled>Salvar</AppButton>
          </State>
          <State label="outline · disabled">
            <AppButton emphasis="outline" disabled>
              Salvar
            </AppButton>
          </State>
        </States>
        <States label="fullWidth">
          <AppStack grow>
            <AppButton fullWidth>Salvar</AppButton>
          </AppStack>
        </States>
      </Entry>

      <Entry
        name="AppIconButton"
        role="A ação que é só um ícone. O label é obrigatório: vira o nome acessível e, com tooltip, o texto ao passar o mouse."
      >
        <States label="tone">
          {(['default', 'inherit', 'primary', 'danger'] as const).map((tone) => (
            <State key={tone} label={tone}>
              <AppIconButton label={tone} tone={tone}>
                <EditIcon />
              </AppIconButton>
            </State>
          ))}
        </States>
        <States label="Tamanho">
          {(['sm', 'md', 'lg'] as const).map((size) => (
            <State key={size} label={size}>
              <AppIconButton label={`Excluir ${size}`} size={size} tone="danger">
                <DeleteIcon fontSize="inherit" />
              </AppIconButton>
            </State>
          ))}
        </States>
        <States label="Estado">
          <State label="tooltip">
            <AppIconButton label="Mais ações" tooltip>
              <MoreVertIcon />
            </AppIconButton>
          </State>
          <State label="bordered · ao lado de botões">
            <AppStack direction="row" gap="sm" align="center">
              <AppButton emphasis="outline">Exportar</AppButton>
              <AppIconButton label="Mais ações" bordered>
                <MoreVertIcon />
              </AppIconButton>
            </AppStack>
          </State>
          <State label="disabled">
            <AppIconButton label="Excluir" tone="danger" disabled>
              <DeleteIcon />
            </AppIconButton>
          </State>
        </States>
      </Entry>

      <Entry name="AppIconLink" role="O ícone que leva a uma rota — um AppIconButton que navega.">
        <AppIconLink to="/admin/design-system/texto" label="Abrir a família de texto">
          <OpenInNewIcon />
        </AppIconLink>
      </Entry>

      <Entry
        name="AppMenuButton + AppMenu"
        role="O gatilho com seta e a lista que ele abre. below é o menu de barra; beside é o submenu de uma coluna de navegação. O AppMenuButton mora na barra do topo, que tem fundo próprio: na superfície clara do card o rótulo quase some, como se vê aqui."
      >
        <States>
          <State label="placement=below">
            <MenuSample placement="below" />
          </State>
          <State label="placement=beside">
            <MenuSample placement="beside" />
          </State>
        </States>
      </Entry>

      <Entry name="ThemeToggleButton" role="Troca entre o tema claro e o escuro escolhidos. Clicar aqui troca o tema do app inteiro.">
        <States>
          <ThemeToggleButton />
        </States>
      </Entry>
    </AppStack>
  )
}
