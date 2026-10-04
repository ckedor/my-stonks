import {
  AppAutocomplete,
  AppColorField,
  AppCopyField,
  AppDateField,
  AppDayField,
  AppFileField,
  AppFilterBar,
  AppMultiAutocomplete,
  AppNumberField,
  AppPasswordField,
  AppSearchField,
  AppSelect,
  AppStack,
  AppTextField,
  useAppTheme,
  type AppMultiAutocompleteOption,
} from '@/components/ui'
import AppHexColorField from '../../components/AppHexColorField'
import AddIcon from '@mui/icons-material/Add'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import dayjs, { type Dayjs } from 'dayjs'
import { useState } from 'react'
import { Entry, State, States } from './Specimen'

interface Asset {
  id: number
  ticker: string
}

const ASSETS: Asset[] = [
  { id: 1, ticker: 'PETR4' },
  { id: 2, ticker: 'HGLG11' },
  { id: 3, ticker: 'BOVA11' },
]

const SERIES: AppMultiAutocompleteOption[] = [
  { id: 'cdi', label: 'CDI', group: 'Juros' },
  { id: 'selic', label: 'Selic', group: 'Juros' },
  { id: 'ibov', label: 'Ibovespa', group: 'Bolsa' },
]

/* Cada amostra guarda o próprio valor, para que se possa digitar nela e ver
 * o campo mudar de estado — o rótulo subindo, o erro sumindo. */

function Text(props: Partial<React.ComponentProps<typeof AppTextField>> & { initial?: string }) {
  const { initial = '', ...rest } = props
  const [value, setValue] = useState(initial)
  return <AppTextField label="Nome" value={value} onChange={setValue} {...rest} />
}

function NumberField(
  props: Partial<Omit<React.ComponentProps<typeof AppNumberField>, 'value' | 'onChange' | 'allowEmpty'>>,
) {
  const [value, setValue] = useState(1250)
  return <AppNumberField label="Quantidade" value={value} onChange={setValue} {...props} />
}

function EmptyNumberField() {
  const [value, setValue] = useState<number | null>(null)
  return <AppNumberField label="Aporte" allowEmpty value={value} onChange={setValue} prefix="R$" size="md" />
}

function Password() {
  const [value, setValue] = useState('segredo')
  return <AppPasswordField value={value} onChange={setValue} />
}

function Search(props: Partial<React.ComponentProps<typeof AppSearchField>>) {
  const [value, setValue] = useState('')
  return <AppSearchField value={value} onChange={setValue} placeholder="Buscar ativo..." {...props} />
}

function DateField({ initial, density }: { initial: Dayjs | null; density?: 'compact' | 'comfortable' }) {
  const [value, setValue] = useState(initial)
  return <AppDateField label="Data" value={value} onChange={setValue} density={density} />
}

function DayField({ size }: { size?: 'auto' | 'md' }) {
  const [value, setValue] = useState('2026-03-17')
  return <AppDayField label="Dia" value={value} onChange={setValue} size={size} />
}

function Autocomplete(props: Partial<React.ComponentProps<typeof AppAutocomplete<Asset>>> & { initial?: Asset | null }) {
  const { initial = null, ...rest } = props
  const [value, setValue] = useState<Asset | null>(initial)
  return (
    <AppAutocomplete<Asset>
      label="Ativo"
      options={ASSETS}
      value={value}
      onChange={setValue}
      getOptionLabel={(asset) => asset.ticker}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      {...rest}
    />
  )
}

function MultiAutocomplete({ initial }: { initial: AppMultiAutocompleteOption[] }) {
  const theme = useAppTheme()
  const [value, setValue] = useState(initial)
  return (
    <AppMultiAutocomplete
      options={SERIES}
      value={value}
      onChange={setValue}
      placeholder="Adicionar série"
      tintOf={(_, index) => theme.palette.chart.colors[index % theme.palette.chart.colors.length]}
    />
  )
}

function ColorField() {
  const theme = useAppTheme()
  const [value, setValue] = useState(theme.palette.chart.colors[2])
  return <AppColorField label="Cor da categoria" value={value} onChange={setValue} />
}

function HexColorField() {
  const theme = useAppTheme()
  const [value, setValue] = useState(theme.palette.chart.colors[3])
  return <AppHexColorField label="Primária" value={value} onChange={setValue} />
}

function FilterBar() {
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState('category')
  return (
    <AppFilterBar>
      <AppSearchField icon size="bar" value={search} onChange={setSearch} placeholder="Buscar ativo..." />
      <AppSelect
        label="Agrupar"
        density="compact"
        value={group}
        onChange={setGroup}
        options={[
          { value: 'category', label: 'Categoria' },
          { value: 'class', label: 'Classe' },
        ]}
      />
    </AppFilterBar>
  )
}

export default function FieldsFamily() {
  return (
    <AppStack gap="lg">
      <Entry
        name="AppTextField"
        role="Texto livre. Rótulo flutuante dentro do campo; para rótulo parado em cima, FieldLabel."
      >
        <States label="Valor" columns={3}>
          <State label="vazio">
            <Text />
          </State>
          <State label="placeholder">
            <Text placeholder="Ex.: Reserva" />
          </State>
          <State label="preenchido">
            <Text initial="Principal" />
          </State>
        </States>
        <States label="Estado" columns={3}>
          <State label="helperText">
            <Text initial="Principal" helperText="Aparece no seletor de carteira" />
          </State>
          <State label="error">
            <Text error helperText="Obrigatório" />
          </State>
          <State label="readOnly">
            <Text initial="gerado-pelo-servidor" readOnly />
          </State>
        </States>
        <States label="Forma" columns={4}>
          <State label="density=compact">
            <Text initial="Principal" density="compact" />
          </State>
          <State label="endAdornment">
            <Text initial="12" label="Prazo" endAdornment="meses" />
          </State>
          <State label="monospace">
            <Text initial="{ prompt }" label="Template" monospace />
          </State>
          <State label="rows=3">
            <Text initial="Texto longo em várias linhas" label="Observação" rows={3} />
          </State>
        </States>
      </Entry>

      <Entry
        name="AppNumberField"
        role="Número com largura nomeada, para não esticar numa linha de formulário. Prefixo e sufixo ficam fora do número."
      >
        <States label="size">
          {(['xs', 'sm', 'md'] as const).map((size) => (
            <State key={size} label={size}>
              <NumberField size={size} />
            </State>
          ))}
        </States>
        <States label="Estado">
          <State label="prefix · align=right">
            <NumberField prefix="R$" align="right" size="md" />
          </State>
          <State label="suffix">
            <NumberField suffix="%" />
          </State>
          <State label="allowEmpty · vazio">
            <EmptyNumberField />
          </State>
          <State label="error">
            <NumberField error helperText="Acima do saldo" size="md" />
          </State>
          <State label="busy">
            <NumberField busy />
          </State>
          <State label="density=comfortable">
            <NumberField density="comfortable" />
          </State>
          <State label="hideLabel">
            <NumberField hideLabel />
          </State>
        </States>
      </Entry>

      <Entry name="AppPasswordField" role="Senha, com o olho que mostra o que se digitou.">
        <Password />
      </Entry>

      <Entry name="AppSearchField" role="Busca que filtra uma lista na tela, a cada tecla.">
        <States columns={3}>
          <State label="size=full">
            <Search label="Buscar" />
          </State>
          <State label="size=bar · icon">
            <Search size="bar" icon />
          </State>
          <State label="hideLabel">
            <Search label="Buscar" hideLabel />
          </State>
        </States>
      </Entry>

      <Entry
        name="AppDateField + AppDayField"
        role="Duas formas de pedir uma data. AppDateField abre um calendário, para a data que se escolhe olhando; AppDayField é digitado, para a barra de filtro onde a data já se sabe."
      >
        <States label="AppDateField" columns={3}>
          <State label="comfortable · vazio">
            <DateField initial={null} />
          </State>
          <State label="comfortable · preenchido">
            <DateField initial={dayjs('2026-03-17')} />
          </State>
          <State label="compact">
            <DateField initial={dayjs('2026-03-17')} density="compact" />
          </State>
        </States>
        <States label="AppDayField">
          <State label="size=auto">
            <DayField />
          </State>
          <State label="size=md">
            <DayField size="md" />
          </State>
        </States>
      </Entry>

      <Entry name="AppAutocomplete" role="Escolha de um item numa lista longa, buscando pelo que se digita.">
        <States label="size" columns={1}>
          {(['sm', 'md', 'lg'] as const).map((size) => (
            <State key={size} label={size}>
              <Autocomplete initial={ASSETS[0]} size={size} />
            </State>
          ))}
        </States>
        <States label="Estado" columns={3}>
          <State label="vazio">
            <Autocomplete />
          </State>
          <State label="preenchido">
            <Autocomplete initial={ASSETS[0]} />
          </State>
          <State label="busy">
            <Autocomplete busy />
          </State>
          <State label="disabled">
            <Autocomplete initial={ASSETS[1]} disabled />
          </State>
          <State label="action · criar o que não achou">
            <Autocomplete
              placeholder="Digite um ticker"
              action={{ label: 'Cadastrar ativo', icon: <AddIcon fontSize="small" />, onSelect: () => undefined }}
            />
          </State>
        </States>
      </Entry>

      <Entry
        name="AppMultiAutocomplete"
        role="Vários itens de uma lista agrupada. Cada escolhido vira um chip na cor da série que ele desenha."
      >
        <States columns={2}>
          <State label="vazio">
            <MultiAutocomplete initial={[]} />
          </State>
          <State label="com valores · tintOf">
            <MultiAutocomplete initial={[SERIES[0], SERIES[2]]} />
          </State>
        </States>
      </Entry>

      <Entry name="AppFileField" role="Escolha de um arquivo para enviar.">
        <States>
          <State label="default">
            <AppFileField label="Nota de corretagem" accept=".pdf" icon={<UploadFileIcon />} onChange={() => undefined} />
          </State>
          <State label="disabled">
            <AppFileField label="Nota de corretagem" disabled onChange={() => undefined} />
          </State>
        </States>
      </Entry>

      <Entry
        name="AppColorField + AppHexColorField"
        role="AppColorField é o seletor do sistema e mais nada. AppHexColorField junta o seletor ao hexadecimal escrito, para colar uma cor vinda de fora."
      >
        <States>
          <State label="AppColorField">
            <ColorField />
          </State>
          <State label="AppHexColorField">
            <HexColorField />
          </State>
        </States>
      </Entry>

      <Entry name="AppCopyField" role="Um valor para copiar: o campo só de leitura com o botão de cópia.">
        <States>
          <State label="uma linha">
            <AppCopyField label="Token" value="sk-••••••••3f9a" copyValue="sk-exemplo-3f9a" />
          </State>
          <State label="multiline">
            <AppCopyField label="Prompt" value={'Linha um do prompt\nLinha dois do prompt'} multiline />
          </State>
        </States>
      </Entry>

      <Entry name="AppFilterBar" role="A faixa que agrupa os filtros de uma listagem e quebra conforme a tela estreita.">
        <FilterBar />
      </Entry>
    </AppStack>
  )
}
