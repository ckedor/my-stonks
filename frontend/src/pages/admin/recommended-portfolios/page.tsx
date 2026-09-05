import {
  createRecommendedPortfolioType,
  deleteRecommendedPortfolio,
  deleteRecommendedPortfolioType,
  extractRecommendedPortfolio,
  fetchRecommendedPortfolios,
  fetchRecommendedPortfolioTypes,
  saveRecommendedPortfolio,
  setRecommendedPortfolioType,
  type DraftPosition,
  type PositionMatch,
  type RecommendationChange,
  type RecommendedPortfolio,
  type RecommendedPortfolioDraft,
  type RecommendedPortfolioType,
} from '@/api/research'
import {
  AppAutocomplete,
  AppButton,
  AppCard,
  AppChip,
  AppDateField,
  AppFileField,
  AppGrid,
  AppGridItem,
  AppIconButton,
  AppMetric,
  AppNumberField,
  AppSelect,
  AppSideDrawer,
  AppSimpleTable,
  AppSnackbar,
  AppStack,
  AppText,
  AppTextField,
  PageTitle,
  SectionTitle,
  type AppSimpleTableColumn,
} from '@/components/ui'
import { ASSET_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import dayjs, { type Dayjs } from 'dayjs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import CrudPageSkeleton from '../CrudPageSkeleton'

/* Importação de carteira recomendada.
 *
 * A tela é o passo que falta entre o relatório e o banco: o PDF vai inteiro
 * para o modelo, o que ele leu volta aqui com cada ticker já procurado no
 * catálogo, e nada é gravado antes de alguém olhar. É por isso que a extração
 * não persiste nada — um peso que ninguém conferiu não vira carteira. */

/** Ativo do catálogo, no mínimo que o vínculo precisa. */
interface CatalogueAsset {
  id: number
  ticker: string | null
  name: string
}

/** Uma linha da conferência: o que o modelo leu mais o que a pessoa corrigiu. */
interface ReviewPosition extends DraftPosition {
  /** Identidade estável enquanto a linha existe só na tela. */
  key: number
}

const MATCH_LABEL: Record<PositionMatch, string> = {
  matched: 'no catálogo',
  unknown: 'sem cadastro',
  ambiguous: 'ticker duplicado',
}

const MATCH_TONE: Record<PositionMatch, 'success' | 'caution' | 'danger'> = {
  matched: 'success',
  unknown: 'caution',
  ambiguous: 'danger',
}

const CHANGE_LABEL: Record<RecommendationChange, string> = {
  entered: 'entrou',
  increased: 'aumentou',
  reduced: 'reduziu',
  unchanged: 'manteve',
  exited: 'saiu',
}

const percent = (value: number) => `${value.toFixed(1)}%`

const money = (value: number | null) =>
  value === null ? '—' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const monthOf = (isoDate: string) => dayjs(isoDate).format('MM/YYYY')

export default function AdminRecommendedPortfoliosPage() {
  const [saved, setSaved] = useState<RecommendedPortfolio[]>([])
  const [types, setTypes] = useState<RecommendedPortfolioType[]>([])
  const [assets, setAssets] = useState<CatalogueAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [newTypeName, setNewTypeName] = useState('')

  const [file, setFile] = useState<File | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)

  const [draft, setDraft] = useState<RecommendedPortfolioDraft | null>(null)
  const [sourceName, setSourceName] = useState('')
  const [title, setTitle] = useState('')
  const [referenceDate, setReferenceDate] = useState<Dayjs | null>(null)
  const [summary, setSummary] = useState('')
  const [objective, setObjective] = useState('')
  const [typeId, setTypeId] = useState('')
  const [positions, setPositions] = useState<ReviewPosition[]>([])

  const [opened, setOpened] = useState<RecommendedPortfolio | null>(null)
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  })

  const notify = useCallback((message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity })
  }, [])

  const loadSaved = useCallback(async () => {
    setSaved(await fetchRecommendedPortfolios())
  }, [])

  const loadTypes = useCallback(async () => {
    setTypes(await fetchRecommendedPortfolioTypes())
  }, [])

  /* O tipo é escolhido, e criado, no mesmo lugar: quem está classificando uma
   * carteira que não se encaixa em nenhum tipo não deveria ter de sair da tela
   * para cadastrar o que falta. */
  const typeOptions = useMemo(
    () => [
      { value: '', label: 'Sem tipo' },
      ...types.map((type) => ({ value: String(type.id), label: type.name })),
    ],
    [types],
  )

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [, , catalogue] = await Promise.all([
          loadSaved(),
          loadTypes(),
          api.get<CatalogueAsset[]>(ASSET_ROUTES.list).then((r) => r.data),
        ])
        setAssets(catalogue)
      } catch {
        notify('Não foi possível carregar as carteiras recomendadas', 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [loadSaved, loadTypes, notify])

  const assetById = useMemo(() => {
    const index = new Map<number, CatalogueAsset>()
    assets.forEach((asset) => index.set(asset.id, asset))
    return index
  }, [assets])

  const handleExtract = async () => {
    if (!file) return
    setExtracting(true)
    try {
      const extracted = await extractRecommendedPortfolio(file)
      setDraft(extracted)
      setSourceName(extracted.source_name ?? '')
      setTitle(extracted.title ?? '')
      setReferenceDate(extracted.reference_date ? dayjs(extracted.reference_date) : null)
      setSummary(extracted.summary ?? '')
      setObjective(extracted.objective ?? '')
      setTypeId('')
      setPositions(extracted.positions.map((position, index) => ({ ...position, key: index })))
    } catch {
      notify('Não foi possível ler o relatório', 'error')
    } finally {
      setExtracting(false)
    }
  }

  const updatePosition = (key: number, changes: Partial<ReviewPosition>) => {
    setPositions((current) =>
      current.map((position) => (position.key === key ? { ...position, ...changes } : position)),
    )
  }

  const discardDraft = () => {
    setDraft(null)
    setPositions([])
    setFile(null)
  }

  const handleSave = async () => {
    if (!referenceDate) return
    setSaving(true)
    try {
      await saveRecommendedPortfolio({
        source_name: sourceName.trim(),
        type_id: typeId ? Number(typeId) : null,
        title: title.trim(),
        reference_date: referenceDate.format('YYYY-MM-DD'),
        summary: summary.trim() || null,
        objective: objective.trim() || null,
        positions: positions.map((position) => ({
          ticker: position.ticker,
          asset_id: position.asset_id,
          name: position.name,
          weight: position.weight,
          rationale: position.rationale,
          target_price: position.target_price,
          change: position.change,
        })),
      })
      discardDraft()
      await loadSaved()
      notify('Carteira recomendada salva', 'success')
    } catch (error) {
      const detail =
        typeof error === 'object' && error !== null && 'response' in error
          ? ((error as { response?: { data?: { message?: string } } }).response?.data?.message ??
            null)
          : null
      notify(detail ?? 'Não foi possível salvar a carteira', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateType = async () => {
    const name = newTypeName.trim()
    if (!name) return
    try {
      await createRecommendedPortfolioType(name)
      setNewTypeName('')
      await loadTypes()
      notify('Tipo cadastrado', 'success')
    } catch (error) {
      const detail =
        typeof error === 'object' && error !== null && 'response' in error
          ? ((error as { response?: { data?: { message?: string } } }).response?.data?.message ??
            null)
          : null
      notify(detail ?? 'Não foi possível cadastrar o tipo', 'error')
    }
  }

  const handleDeleteType = async (type: RecommendedPortfolioType) => {
    try {
      await deleteRecommendedPortfolioType(type.id)
      await Promise.all([loadTypes(), loadSaved()])
      notify('Tipo removido', 'success')
    } catch {
      notify('Não foi possível remover o tipo', 'error')
    }
  }

  const handleSetType = async (portfolio: RecommendedPortfolio, value: string) => {
    try {
      await setRecommendedPortfolioType(portfolio.id, value ? Number(value) : null)
      await loadSaved()
    } catch {
      notify('Não foi possível mudar o tipo da carteira', 'error')
    }
  }

  const handleDelete = async (portfolio: RecommendedPortfolio) => {
    try {
      await deleteRecommendedPortfolio(portfolio.id)
      await loadSaved()
      notify('Carteira recomendada removida', 'success')
    } catch {
      notify('Não foi possível remover a carteira', 'error')
    }
  }

  const readWeight = positions.reduce((total, position) => total + position.weight, 0)
  const unlinked = positions.filter((position) => position.asset_id === null).length
  const canSave = Boolean(sourceName.trim() && title.trim() && referenceDate && positions.length)

  const reviewColumns: AppSimpleTableColumn<ReviewPosition>[] = [
    {
      label: 'Ticker',
      render: (position) => (
        <AppStack gap="none">
          <AppText weight="strong">{position.ticker}</AppText>
          {position.name && (
            <AppText variant="caption" tone="secondary">
              {position.name}
            </AppText>
          )}
        </AppStack>
      ),
    },
    {
      label: 'Ativo no catálogo',
      hint: 'O ticker do relatório procurado na base. Sem vínculo a linha é guardada assim mesmo.',
      render: (position) => (
        <AppStack gap="xs">
          <AppAutocomplete
            options={assets}
            value={position.asset_id === null ? null : (assetById.get(position.asset_id) ?? null)}
            onChange={(asset) =>
              updatePosition(position.key, {
                asset_id: asset?.id ?? null,
                asset_name: asset?.name ?? null,
              })
            }
            getOptionLabel={(asset) => `${asset.ticker ?? '—'} · ${asset.name}`}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            label="Ativo"
            size="sm"
            placeholder="sem vínculo"
          />
          <AppChip
            label={MATCH_LABEL[position.match]}
            tone={MATCH_TONE[position.match]}
            emphasis="outline"
          />
        </AppStack>
      ),
    },
    {
      label: 'Peso',
      align: 'right',
      render: (position) => (
        <AppNumberField
          label="Peso"
          hideLabel
          align="right"
          size="xs"
          suffix="%"
          step={0.1}
          value={position.weight}
          onChange={(weight) => updatePosition(position.key, { weight })}
        />
      ),
    },
    {
      label: 'Preço-alvo',
      align: 'right',
      render: (position) => <AppText noWrap>{money(position.target_price)}</AppText>,
    },
    {
      label: 'Mudança',
      render: (position) =>
        position.change ? <AppChip label={CHANGE_LABEL[position.change]} /> : <AppText>—</AppText>,
    },
    {
      label: 'Tese',
      width: 'clamped',
      render: (position) => (
        <AppText variant="bodySmall" tone="secondary">
          {position.rationale ?? '—'}
        </AppText>
      ),
    },
    {
      label: '',
      align: 'right',
      render: (position) => (
        <AppIconButton
          label="Remover linha"
          tone="error"
          size="sm"
          tooltip
          onClick={() =>
            setPositions((current) => current.filter((item) => item.key !== position.key))
          }
        >
          <DeleteOutlineIcon fontSize="small" />
        </AppIconButton>
      ),
    },
  ]

  const typeColumns: AppSimpleTableColumn<RecommendedPortfolioType>[] = [
    {
      label: 'Tipo',
      render: (type) => <AppText weight="strong">{type.name}</AppText>,
    },
    {
      label: 'Carteiras',
      align: 'right',
      render: (type) => (
        <AppText>{saved.filter((portfolio) => portfolio.type_id === type.id).length}</AppText>
      ),
    },
    {
      label: '',
      align: 'right',
      render: (type) => (
        <AppIconButton
          label="Remover tipo"
          tone="error"
          size="sm"
          tooltip
          onClick={() => handleDeleteType(type)}
        >
          <DeleteOutlineIcon fontSize="small" />
        </AppIconButton>
      ),
    },
  ]

  const savedColumns: AppSimpleTableColumn<RecommendedPortfolio>[] = [
    {
      label: 'Fonte',
      sortValue: (portfolio) => portfolio.source?.name ?? '',
      render: (portfolio) => <AppText>{portfolio.source?.name ?? '—'}</AppText>,
    },
    {
      label: 'Carteira',
      sortValue: (portfolio) => portfolio.title,
      render: (portfolio) => <AppText weight="strong">{portfolio.title}</AppText>,
    },
    {
      label: 'Tipo',
      hint: 'A espécie de carteira. Editável aqui: a classificação é do mantenedor, não do relatório.',
      sortValue: (portfolio) => portfolio.type?.name ?? '',
      render: (portfolio) => (
        <AppSelect
          options={typeOptions}
          value={portfolio.type_id === null ? '' : String(portfolio.type_id)}
          onChange={(value) => void handleSetType(portfolio, value)}
          size="sm"
        />
      ),
    },
    {
      label: 'Competência',
      sortValue: (portfolio) => portfolio.reference_date,
      render: (portfolio) => <AppText>{monthOf(portfolio.reference_date)}</AppText>,
    },
    {
      label: 'Ativos',
      align: 'right',
      sortValue: (portfolio) => portfolio.positions.length,
      render: (portfolio) => <AppText>{portfolio.positions.length}</AppText>,
    },
    {
      label: 'Sem vínculo',
      align: 'right',
      hint: 'Linhas cujo ticker o catálogo ainda não carrega.',
      render: (portfolio) => (
        <AppText>{portfolio.positions.filter((p) => p.asset_id === null).length}</AppText>
      ),
    },
    {
      label: '',
      align: 'right',
      render: (portfolio) => (
        <AppIconButton
          label="Remover carteira"
          tone="error"
          size="sm"
          tooltip
          onClick={() => handleDelete(portfolio)}
        >
          <DeleteOutlineIcon fontSize="small" />
        </AppIconButton>
      ),
    },
  ]

  if (loading) {
    return <CrudPageSkeleton columns={savedColumns.length} action={false} search={false} rows={5} />
  }

  return (
    <>
      <AppStack gap="lg">
        <PageTitle>Carteiras recomendadas</PageTitle>

        <AppStack gap="md">
          <SectionTitle>Importar relatório</SectionTitle>
          <AppCard>
            <AppStack gap="md">
              <AppText variant="bodySmall" tone="secondary">
                O PDF vai inteiro para o modelo, que devolve a carteira, o resumo, o objetivo e a
                tese de cada ativo. Nada é gravado antes da conferência abaixo.
              </AppText>
              <AppStack direction="row" gap="sm" align="center" wrap>
                <AppFileField
                  label="Escolher relatório"
                  accept="application/pdf"
                  icon={<UploadFileIcon fontSize="small" />}
                  onChange={setFile}
                  disabled={extracting}
                />
                <AppButton onClick={handleExtract} disabled={!file} loading={extracting}>
                  Extrair carteira
                </AppButton>
              </AppStack>
            </AppStack>
          </AppCard>
        </AppStack>

        {draft && (
          <AppStack gap="md">
            <SectionTitle>Conferência</SectionTitle>
            <AppCard>
              <AppStack gap="lg">
                <AppStack direction="row" gap="lg" wrap>
                  <AppMetric label="Ativos lidos" value={String(positions.length)} />
                  <AppMetric
                    label="Soma dos pesos"
                    value={percent(readWeight)}
                    hint="Como foram lidos. 97% pode ser linha perdida ou caixa na carteira — só quem leu o relatório sabe."
                  />
                  <AppMetric
                    label="Sem vínculo"
                    value={String(unlinked)}
                    hint="Guardadas assim mesmo: descartá-las mudaria o peso das que ficaram."
                  />
                  {draft.model && <AppMetric label="Modelo" value={draft.model} />}
                </AppStack>

                <AppGrid cols={{ xs: 1, md: 3 }} gap="md">
                  <AppGridItem>
                    <AppTextField label="Fonte" value={sourceName} onChange={setSourceName} />
                  </AppGridItem>
                  <AppGridItem>
                    <AppTextField label="Carteira" value={title} onChange={setTitle} />
                  </AppGridItem>
                  <AppGridItem>
                    <AppDateField
                      label="Competência"
                      value={referenceDate}
                      onChange={setReferenceDate}
                    />
                  </AppGridItem>
                  <AppGridItem>
                    <AppSelect
                      label="Tipo"
                      options={typeOptions}
                      value={typeId}
                      onChange={setTypeId}
                      size="full"
                      density="comfortable"
                    />
                  </AppGridItem>
                </AppGrid>

                <AppGrid cols={{ xs: 1, md: 2 }} gap="md">
                  <AppGridItem>
                    <AppTextField label="Resumo" value={summary} onChange={setSummary} rows={4} />
                  </AppGridItem>
                  <AppGridItem>
                    <AppTextField
                      label="Objetivo"
                      value={objective}
                      onChange={setObjective}
                      rows={4}
                    />
                  </AppGridItem>
                </AppGrid>

                <AppSimpleTable
                  rows={positions}
                  columns={reviewColumns}
                  getRowKey={(position) => position.key}
                  surface="outlined"
                  emptyMessage="O modelo não encontrou nenhuma linha de carteira neste relatório."
                />

                <AppStack direction="row" gap="sm" justify="end">
                  <AppButton emphasis="outline" onClick={discardDraft} disabled={saving}>
                    Descartar
                  </AppButton>
                  <AppButton onClick={handleSave} disabled={!canSave} loading={saving}>
                    Salvar carteira
                  </AppButton>
                </AppStack>
              </AppStack>
            </AppCard>
          </AppStack>
        )}

        <AppStack gap="md">
          <SectionTitle>Tipos de carteira</SectionTitle>
          <AppCard>
            <AppStack gap="md">
              <AppText variant="bodySmall" tone="secondary">
                A lista que classifica as carteiras. Apagar um tipo não apaga as carteiras dele —
                elas voltam a ficar sem tipo.
              </AppText>
              <AppStack direction="row" gap="sm" align="center" wrap>
                <AppTextField
                  label="Novo tipo"
                  value={newTypeName}
                  onChange={setNewTypeName}
                  placeholder="ETF Global"
                />
                <AppButton icon={<AddIcon />} onClick={handleCreateType} disabled={!newTypeName.trim()}>
                  Cadastrar tipo
                </AppButton>
              </AppStack>
              <AppSimpleTable
                rows={types}
                columns={typeColumns}
                getRowKey={(type) => type.id}
                surface="outlined"
                emptyMessage="Nenhum tipo cadastrado."
              />
            </AppStack>
          </AppCard>
        </AppStack>

        <AppStack gap="md">
          <SectionTitle>Carteiras salvas</SectionTitle>
          <AppSimpleTable
            rows={saved}
            columns={savedColumns}
            getRowKey={(portfolio) => portfolio.id}
            surface="outlined"
            onRowClick={setOpened}
            defaultSort={{ column: 'Competência', direction: 'desc' }}
            emptyMessage="Nenhuma carteira recomendada importada ainda."
          />
        </AppStack>
      </AppStack>

      <AppSideDrawer
        open={opened !== null}
        onClose={() => setOpened(null)}
        title={
          opened
            ? `${opened.title} · ${opened.type?.name ?? 'sem tipo'} · ${monthOf(opened.reference_date)}`
            : ''
        }
        width="md"
      >
        {opened && (
          <AppStack gap="md">
            {opened.objective && (
              <AppStack gap="xs">
                <AppText weight="strong">Objetivo</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  {opened.objective}
                </AppText>
              </AppStack>
            )}
            {opened.summary && (
              <AppStack gap="xs">
                <AppText weight="strong">Resumo</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  {opened.summary}
                </AppText>
              </AppStack>
            )}
            <AppSimpleTable
              rows={opened.positions}
              columns={[
                {
                  label: 'Ticker',
                  render: (position) => <AppText weight="strong">{position.ticker}</AppText>,
                },
                {
                  label: 'Peso',
                  align: 'right',
                  render: (position) => <AppText>{percent(position.weight)}</AppText>,
                },
                {
                  label: 'Mudança',
                  render: (position) => (
                    <AppText>{position.change ? CHANGE_LABEL[position.change] : '—'}</AppText>
                  ),
                },
                {
                  label: 'Tese',
                  width: 'clamped',
                  render: (position) => (
                    <AppText variant="bodySmall" tone="secondary">
                      {position.rationale ?? '—'}
                    </AppText>
                  ),
                },
              ]}
              getRowKey={(position) => position.id}
              surface="outlined"
            />
          </AppStack>
        )}
      </AppSideDrawer>

      <AppSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      />
    </>
  )
}
