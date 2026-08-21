import { syncPortfolios, syncReturns } from '@/actions/portfolio'
import { CATEGORY_ROUTES, MARKET_DATA_SERIES_ROUTES, PORTFOLIO_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  AppButton,
  AppColorField,
  AppConfirmDialog,
  AppFormDrawer,
  AppIconButton,
  AppSelect,
  AppSnackbar,
  AppStack,
  AppStackItem,
  AppTextField,
  SectionTitle,
} from '@/components/ui'
import { useEffect, useState } from 'react'
import { NO_BENCHMARK, benchmarkOptions, type BenchmarkOption } from './benchmark-options'

interface UserCategory {
  id?: number
  name: string
  color: string
  benchmark_id?: number | null
  portfolio_id?: number | null
}

interface Portfolio {
  id: number
  name: string
  custom_categories: UserCategory[]
}

interface PortfolioFormProps {
  open: boolean
  onClose: () => void
  onSave?: (selectedId?: number | null) => void
  portfolio?: Portfolio // se presente, modo edição
}

export default function PortfolioForm({ open, onClose, onSave, portfolio }: PortfolioFormProps) {
  const isEdit = Boolean(portfolio)

  const [name, setName] = useState('')
  const [categories, setCategories] = useState<UserCategory[]>([])
  const [benchmarks, setBenchmarks] = useState<BenchmarkOption[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [successOpen, setSuccessOpen] = useState(false)

  useEffect(() => {
    if (open) {
      if (portfolio) {
        setName(portfolio.name)
        setCategories(portfolio.custom_categories.map((c) => ({ ...c })))
      } else {
        setName('')
        setCategories([{ name: 'Renda Fixa', color: '#1976d2', benchmark_id: 3 }])
      }
      fetchBenchmarks()
    }
  }, [open, portfolio])

  const fetchBenchmarks = async () => {
    try {
      const { data } = await api.get<BenchmarkOption[]>(MARKET_DATA_SERIES_ROUTES.list)
      setBenchmarks(data)
    } catch (err) {
      console.error('Erro ao carregar benchmarks', err)
    }
  }

  const handleChange = <K extends keyof UserCategory>(
    index: number,
    field: K,
    value: UserCategory[K]
  ) => {
    const updated = [...categories]
    updated[index][field] = value
    setCategories(updated)
  }

  const handleAdd = () => {
    setCategories([
      ...categories,
      { name: '', color: '#000000', benchmark_id: 3, portfolio_id: portfolio?.id },
    ])
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      if (isEdit) {
        await api.put(PORTFOLIO_ROUTES.byId(portfolio?.id ?? ''), {
          id: portfolio?.id,
          name,
          user_categories: categories,
        })
        await syncPortfolios(true)
        if (portfolio?.id) await syncReturns(portfolio.id, true)
        if (onSave) onSave(portfolio?.id)
      } else {
        const { data } = await api.post(PORTFOLIO_ROUTES.create, {
          name,
          user_categories: categories,
        })
        if (onSave) onSave(data.id)
      }
      setSuccessOpen(true)
      onClose()
    } catch (err) {
      console.error('Erro ao salvar carteira', err)
      setError('Erro ao salvar carteira.')
      setSnackbarOpen(true)
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePortfolio = async () => {
    if (!portfolio?.id) return
    try {
      await api.delete(PORTFOLIO_ROUTES.byId(portfolio.id))
      setConfirmDelete(false)
      onClose()
      if (onSave) onSave(null)
    } catch (err) {
      console.error('Erro ao deletar carteira', err)
      setError('Erro ao deletar carteira.')
      setSnackbarOpen(true)
    }
  }

  const deleteCategory = async () => {
    if (categories.length === 1) {
      setError('É necessário manter pelo menos uma categoria.')
      setSnackbarOpen(true)
      setConfirmDeleteCategory(null)
      return
    }

    if (confirmDeleteCategory === null) return

    const cat = categories[confirmDeleteCategory]
    const updated = [...categories]

    if (cat.id) {
      try {
        await api.delete(CATEGORY_ROUTES.byId(cat.id), {
          data: { portfolio_id: portfolio?.id },
        })
        await syncPortfolios(true)
        if (portfolio?.id) await syncReturns(portfolio.id, true)
      } catch (err) {
        console.error('Erro ao deletar categoria', err)
        setError('Erro ao deletar categoria.')
        setSnackbarOpen(true)
        setConfirmDeleteCategory(null)
        return
      }
    }

    updated.splice(confirmDeleteCategory, 1)
    setCategories(updated)
    setConfirmDeleteCategory(null)
  }

  return (
    <>
      <AppFormDrawer
        open={open}
        onClose={onClose}
        title={isEdit ? 'Editar Carteira' : 'Nova Carteira'}
        width="lg"
        onDelete={isEdit ? () => setConfirmDelete(true) : undefined}
        deleteLabel="Excluir carteira"
        header={
          <AppStack gap="md">
            <AppTextField label="Nome da Carteira" value={name} onChange={setName} />
            <SectionTitle>Categorias</SectionTitle>
          </AppStack>
        }
        submitLabel={isEdit ? 'Salvar Alterações' : 'Criar Carteira'}
        onSubmit={handleSave}
        submitDisabled={!name.trim()}
        submitting={loading}
      >
        {categories.map((cat, index) => (
          <AppStack key={index} direction="row" gap="md" align="center">
            <AppStackItem grow={2}>
              <AppTextField
                value={cat.name}
                onChange={(value) => handleChange(index, 'name', value)}
              />
            </AppStackItem>

            <AppStackItem grow={1.5} minWidth={150}>
              <AppSelect
                size="full"
                density="comfortable"
                options={benchmarkOptions(benchmarks)}
                value={cat.benchmark_id == null ? NO_BENCHMARK : String(cat.benchmark_id)}
                onChange={(value) =>
                  handleChange(index, 'benchmark_id', value === NO_BENCHMARK ? null : Number(value))
                }
              />
            </AppStackItem>

            <AppStack direction="row" gap="sm" align="center">
              <AppColorField
                label={`Cor da categoria ${cat.name}`}
                value={cat.color}
                onChange={(value) => handleChange(index, 'color', value)}
              />
              <AppIconButton
                label={`Excluir categoria ${cat.name}`}
                onClick={() => setConfirmDeleteCategory(index)}
              >
                <DeleteIcon />
              </AppIconButton>
            </AppStack>
          </AppStack>
        ))}

        <AppButton emphasis="outline" fullWidth onClick={handleAdd}>
          Adicionar Categoria
        </AppButton>
      </AppFormDrawer>

      <AppConfirmDialog
        open={confirmDelete}
        title="Confirmar Exclusão"
        confirmLabel="Excluir"
        onConfirm={handleDeletePortfolio}
        onCancel={() => setConfirmDelete(false)}
      >
        Tem certeza que deseja excluir esta carteira? Todas as transações, posições e dividendos
        associados a ela serão removidos. Essa ação não poderá ser desfeita.
      </AppConfirmDialog>

      <AppConfirmDialog
        open={confirmDeleteCategory !== null}
        title="Confirmar Exclusão"
        confirmLabel="Excluir"
        onConfirm={deleteCategory}
        onCancel={() => setConfirmDeleteCategory(null)}
      >
        Tem certeza que deseja excluir esta categoria? Essa ação não poderá ser desfeita.
      </AppConfirmDialog>

      <AppSnackbar
        open={snackbarOpen}
        message={error ?? ''}
        severity="error"
        onClose={() => setSnackbarOpen(false)}
      />

      <AppSnackbar
        open={successOpen}
        message={isEdit ? 'Carteira atualizada!' : 'Carteira criada com sucesso!'}
        severity="success"
        onClose={() => setSuccessOpen(false)}
      />
    </>
  )
}
