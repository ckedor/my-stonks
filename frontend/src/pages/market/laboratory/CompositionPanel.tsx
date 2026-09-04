import type { CatalogueAsset, MarketDataSeriesOption } from '@/api/market'
import { FIXED_INCOME_TYPE } from '@/api/lab'
import {
  AppAutocomplete,
  AppButton,
  AppNumberField,
  AppSearchField,
  AppSelect,
  AppStack,
  AppText,
  SectionLabel,
} from '@/components/ui'
import { useMemo, useState } from 'react'
import type { DraftLine } from './useLaboratory'

/* O painel de ferramentas: por onde uma linha entra na carteira.
 *
 * São três origens, e elas são três porque viram preço de três jeitos — um
 * ativo do cadastro, um índice inteiro, e uma renda fixa sintética. Misturá-las
 * num seletor só faria escolher "CDI" ser ambíguo entre o índice e um CDB que
 * rende 110% dele. */

const RATE_KIND_OPTIONS = [
  { value: String(FIXED_INCOME_TYPE.percentOfIndex), label: '% do índice' },
  { value: String(FIXED_INCOME_TYPE.indexPlus), label: 'Índice + taxa' },
  { value: String(FIXED_INCOME_TYPE.fixedRate), label: 'Prefixado' },
]

interface Props {
  assets: CatalogueAsset[]
  series: MarketDataSeriesOption[]
  usedAssetIds: Set<number>
  onAdd: (line: Omit<DraftLine, 'key'>) => void
}

export default function CompositionPanel({ assets, series, usedAssetIds, onAdd }: Props) {
  const [search, setSearch] = useState('')
  const [typeId, setTypeId] = useState('all')
  const [asset, setAsset] = useState<CatalogueAsset | null>(null)
  const [seriesId, setSeriesId] = useState('')
  const [rateKind, setRateKind] = useState(String(FIXED_INCOME_TYPE.percentOfIndex))
  const [rateSeriesId, setRateSeriesId] = useState('')
  const [rate, setRate] = useState(110)

  const typeOptions = useMemo(() => {
    const byId = new Map<number, string>()
    for (const item of assets) byId.set(item.asset_type_id, item.asset_type.short_name)
    return [
      { value: 'all', label: 'Todos os tipos' },
      ...[...byId.entries()]
        .map(([value, label]) => ({ value: String(value), label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ]
  }, [assets])

  /* Não há rota de busca no servidor: a lista inteira vem em cache e o filtro
     é daqui. Um ativo já na carteira sai das opções — o backend recusaria a
     linha repetida, e é melhor não oferecer do que recusar depois. */
  const options = useMemo(() => {
    const term = search.trim().toLowerCase()
    return assets
      .filter((item) => !usedAssetIds.has(item.id))
      .filter((item) => typeId === 'all' || String(item.asset_type_id) === typeId)
      .filter(
        (item) =>
          term === '' ||
          item.ticker?.toLowerCase().includes(term) ||
          item.name.toLowerCase().includes(term),
      )
      .slice(0, 200)
  }, [assets, search, typeId, usedAssetIds])

  const seriesOptions = series.map((item) => ({
    value: String(item.id),
    label: item.short_name || item.name,
  }))
  const seriesName = (id: string) =>
    series.find((item) => String(item.id) === id)?.short_name ?? ''

  const isFixedRate = rateKind === String(FIXED_INCOME_TYPE.fixedRate)
  const isPercentOfIndex = rateKind === String(FIXED_INCOME_TYPE.percentOfIndex)

  const addAsset = () => {
    if (!asset) return
    onAdd({
      weight: 0,
      assetId: asset.id,
      seriesId: null,
      fixedIncomeTypeId: null,
      rate: null,
      label: asset.ticker || asset.name,
    })
    setAsset(null)
  }

  const addSeries = () => {
    if (!seriesId) return
    onAdd({
      weight: 0,
      assetId: null,
      seriesId: Number(seriesId),
      fixedIncomeTypeId: null,
      rate: null,
      label: seriesName(seriesId),
    })
    setSeriesId('')
  }

  const addFixedIncome = () => {
    if (!isFixedRate && !rateSeriesId) return
    const name = seriesName(rateSeriesId)
    const label = isFixedRate
      ? `Prefixado ${rate}%`
      : isPercentOfIndex
        ? `${rate}% do ${name}`
        : `${name} + ${rate}%`
    onAdd({
      weight: 0,
      assetId: null,
      seriesId: isFixedRate ? null : Number(rateSeriesId),
      fixedIncomeTypeId: Number(rateKind),
      // A taxa é fração no contrato: 110% do CDI é 1.1, IPCA + 6% é 0.06.
      rate: rate / 100,
      label,
    })
  }

  return (
    <AppStack gap="lg">
      <AppStack gap="sm">
        <SectionLabel>Ativo do cadastro</SectionLabel>
        <AppStack direction="row" gap="sm" wrap>
          <AppSearchField
            value={search}
            onChange={setSearch}
            placeholder="Buscar por código ou nome"
          />
          <AppSelect
            label="Tipo"
            value={typeId}
            onChange={setTypeId}
            options={typeOptions}
          />
        </AppStack>
        <AppAutocomplete
          label="Ativo"
          value={asset}
          onChange={setAsset}
          options={options}
          getOptionLabel={(item) =>
            item.ticker ? `${item.ticker} · ${item.name}` : item.name
          }
          isOptionEqualToValue={(a, b) => a.id === b.id}
        />
        <AppButton onClick={addAsset} disabled={!asset}>
          Adicionar ativo
        </AppButton>
      </AppStack>

      <AppStack gap="sm">
        <SectionLabel>Índice</SectionLabel>
        <AppText variant="caption" tone="secondary">
          A série inteira como uma linha da carteira: o Ibovespa, o IFIX, o S&P
          500.
        </AppText>
        <AppSelect
          label="Série"
          value={seriesId}
          onChange={setSeriesId}
          options={seriesOptions}
        />
        <AppButton onClick={addSeries} disabled={!seriesId} emphasis="outline">
          Adicionar índice
        </AppButton>
      </AppStack>

      <AppStack gap="sm">
        <SectionLabel>Renda fixa sintética</SectionLabel>
        <AppText variant="caption" tone="secondary">
          Um CDB ou um Tesouro não têm cotação. Aqui eles são uma taxa sobre uma
          série — 110% do CDI, IPCA + 6%.
        </AppText>
        <AppSelect
          label="Rentabilidade"
          value={rateKind}
          onChange={setRateKind}
          options={RATE_KIND_OPTIONS}
        />
        {!isFixedRate && (
          <AppSelect
            label="Índice"
            value={rateSeriesId}
            onChange={setRateSeriesId}
            options={seriesOptions}
          />
        )}
        <AppNumberField
          label={isPercentOfIndex ? 'Percentual do índice' : 'Taxa ao ano'}
          value={rate}
          onChange={setRate}
          suffix="%"
          step={isPercentOfIndex ? 5 : 0.5}
          min={0}
          size="sm"
        />
        <AppButton
          onClick={addFixedIncome}
          disabled={!isFixedRate && !rateSeriesId}
          emphasis="outline"
        >
          Adicionar renda fixa
        </AppButton>
      </AppStack>
    </AppStack>
  )
}
