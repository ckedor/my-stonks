import {
  AppInlineToggle,
  AppSegmentedToggle,
  AppSelect,
  AppStack,
  AppSwitch,
  AppTabs,
  AppToggleButton,
  AppToggleGroup,
  type AppSelectOption,
} from '@/components/ui'
import AddIcon from '@mui/icons-material/Add'
import BarChartIcon from '@mui/icons-material/BarChart'
import CandlestickChartIcon from '@mui/icons-material/CandlestickChart'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import StraightenIcon from '@mui/icons-material/Straighten'
import { useState } from 'react'
import { Entry, State, States } from './Specimen'

const PERIODS = [
  { value: '1m', label: '1M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1A' },
  { value: 'all', label: 'Tudo' },
]

const SERIES_OPTIONS: AppSelectOption[] = [
  { value: 'cdi', label: 'CDI' },
  { value: 'ibov', label: 'Ibovespa' },
  { value: 'ipca', label: 'IPCA' },
]

const GROUPING_OPTIONS: AppSelectOption[] = [
  { value: 'day', label: 'Diário', shortLabel: 'D' },
  { value: 'month', label: 'Mensal', shortLabel: 'M' },
]

/* Cada amostra guarda o próprio estado: o catálogo é para mexer, e um
 * controle que não responde ao clique não mostra o estado ativo. */

function Tabs({ withIcons }: { withIcons?: boolean }) {
  const [value, setValue] = useState<'resumo' | 'posicoes' | 'proventos'>('resumo')
  return (
    <AppTabs
      label="Exemplo de abas"
      value={value}
      onChange={setValue}
      items={[
        { id: 'resumo', label: 'Resumo', ...(withIcons ? { icon: <ShowChartIcon fontSize="small" /> } : null) },
        { id: 'posicoes', label: 'Posições', ...(withIcons ? { icon: <BarChartIcon fontSize="small" /> } : null) },
        { id: 'proventos', label: 'Proventos' },
      ]}
    />
  )
}

function ToggleGroup({ icons, disabled }: { icons?: boolean; disabled?: boolean }) {
  const [value, setValue] = useState<'line' | 'bars' | 'candle'>('line')
  return (
    <AppToggleGroup
      label="Tipo de gráfico"
      value={value}
      onChange={setValue}
      options={[
        { value: 'line', label: 'Linha', ...(icons ? { icon: <ShowChartIcon fontSize="small" />, hint: 'Linha' } : null) },
        { value: 'bars', label: 'Barras', ...(icons ? { icon: <BarChartIcon fontSize="small" />, hint: 'Barras' } : null) },
        {
          value: 'candle',
          label: 'Velas',
          disabled,
          ...(icons ? { icon: <CandlestickChartIcon fontSize="small" />, hint: 'Velas' } : null),
        },
      ]}
    />
  )
}

function SegmentedToggle() {
  const [value, setValue] = useState<'BRL' | 'USD'>('BRL')
  return (
    <AppSegmentedToggle
      label="Moeda"
      value={value}
      onChange={setValue}
      options={[
        { value: 'BRL', label: 'R$' },
        { value: 'USD', label: 'US$' },
      ]}
    />
  )
}

function InlineToggle() {
  const [value, setValue] = useState('1y')
  return <AppInlineToggle options={PERIODS} value={value} onChange={setValue} />
}

function ToggleButton({ initial }: { initial: boolean }) {
  const [pressed, setPressed] = useState(initial)
  return (
    <AppToggleButton
      label="Régua"
      icon={<StraightenIcon fontSize="small" />}
      hint="Clique em duas velas para medir a variação entre elas."
      pressed={pressed}
      onChange={setPressed}
    />
  )
}

function Switch({ initial, hint, description }: { initial: boolean; hint?: string; description?: string }) {
  const [checked, setChecked] = useState(initial)
  return (
    <AppSwitch
      label={description ? 'Simular aporte' : 'MM200'}
      checked={checked}
      onChange={setChecked}
      hint={hint}
      description={description}
    />
  )
}

function Select(props: Partial<React.ComponentProps<typeof AppSelect>>) {
  const [value, setValue] = useState(props.options?.[0]?.value ?? 'cdi')
  return <AppSelect options={SERIES_OPTIONS} value={value} onChange={setValue} {...props} />
}

export default function ChoiceFamily() {
  return (
    <AppStack gap="lg">
      <Entry
        name="AppTabs"
        role="Navega entre as seções de uma tela. Não é filtro: trocar de aba troca de assunto, não de recorte do mesmo dado."
      >
        <States>
          <State label="só rótulo">
            <Tabs />
          </State>
          <State label="icon">
            <Tabs withIcons />
          </State>
        </States>
      </Entry>

      <Entry
        name="AppToggleGroup"
        role="O controle segmentado das telas: o modo de um gráfico, a lista-ou-cards. Nunca fica sem seleção."
      >
        <States>
          <State label="rótulo">
            <ToggleGroup />
          </State>
          <State label="icon + hint">
            <ToggleGroup icons />
          </State>
          <State label="opção disabled">
            <ToggleGroup disabled />
          </State>
        </States>
      </Entry>

      <Entry
        name="AppSegmentedToggle"
        role="Duas opções num trilho com pílula — o da barra do topo, que tem fundo próprio e onde o AppToggleGroup some."
      >
        <SegmentedToggle />
      </Entry>

      <Entry
        name="AppInlineToggle"
        role="Texto puro, só o peso muda: o período no canto de um gráfico, onde até a moldura de um botão compete com o desenho."
      >
        <InlineToggle />
      </Entry>

      <Entry
        name="AppToggleButton"
        role="Uma ferramenta que se liga e desliga sobre o gráfico. Mesmo desenho de um botão do AppToggleGroup, mas sozinho e sem exclusão."
      >
        <States>
          <State label="desligado">
            <ToggleButton initial={false} />
          </State>
          <State label="pressionado">
            <ToggleButton initial />
          </State>
        </States>
      </Entry>

      <Entry
        name="AppSwitch"
        role="Liga ou desliga uma camada ou uma opção. Com description, vira a linha de uma tela de configuração."
      >
        <States>
          <State label="desligado">
            <Switch initial={false} />
          </State>
          <State label="ligado">
            <Switch initial />
          </State>
          <State label="hint">
            <Switch initial hint="Média móvel de 200 dias" />
          </State>
        </States>
        <States label="description">
          <Switch
            initial={false}
            description="Distribui o dinheiro novo comprando o que está mais atrasado, sem sugerir venda."
          />
        </States>
      </Entry>

      <Entry
        name="AppSelect"
        role="Escolha entre muitas opções, numa lista que abre. Para poucas que precisam estar à vista, o AppToggleGroup."
      >
        <States label="size">
          {(['sm', 'md'] as const).map((size) => (
            <State key={size} label={size}>
              <Select label="Comparar com" size={size} />
            </State>
          ))}
          <State label="auto · sem label, numa barra">
            <Select size="auto" />
          </State>
        </States>
        <States label="Densidade e variante">
          <State label="density=compact">
            <Select label="Comparar com" />
          </State>
          <State label="density=comfortable">
            <Select label="Comparar com" density="comfortable" />
          </State>
          <State label="variant=inline · numa frase">
            <Select variant="inline" size="auto" />
          </State>
          <State label="sem label · shortLabel">
            <Select options={GROUPING_OPTIONS} size="auto" />
          </State>
        </States>
        <States label="Estado">
          <State label="error + helperText">
            <Select label="Comparar com" density="comfortable" error helperText="Escolha uma série" />
          </State>
          <State label="actions">
            <Select
              label="Categoria"
              density="comfortable"
              actions={[{ label: 'Nova categoria', icon: <AddIcon fontSize="small" />, onSelect: () => undefined }]}
            />
          </State>
        </States>
      </Entry>
    </AppStack>
  )
}
