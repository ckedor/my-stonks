import { useRefreshPortfolio, useSelectedPortfolio } from '@/queries/portfolio'
import { CATEGORY_ROUTES, MARKET_DATA_SERIES_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import AddIcon from '@mui/icons-material/Add'
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
} from '@/components/ui'
import { useEffect, useMemo, useState } from 'react'
import { NO_BENCHMARK, benchmarkOptions, type BenchmarkOption } from './benchmark-options'

interface Category {
  id?: number | null
  name: string
  color: string
  portfolio_id?: number
  benchmark_id?: number | null
}

interface CategoryFormProps {
  open: boolean
  onClose: () => void
  onSave?: () => void
}

export default function CategoryForm({ open, onClose, onSave }: CategoryFormProps) {
  const refreshPortfolio = useRefreshPortfolio()
  const selectedPortfolio = useSelectedPortfolio()
  const userCategories = useMemo(
    () => selectedPortfolio?.custom_categories ?? [],
    [selectedPortfolio?.custom_categories]
  )

  const [categories, setCategories] = useState<Category[]>([])
  const [benchmarks, setBenchmarks] = useState<BenchmarkOption[]>([])
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [successOpen, setSuccessOpen] = useState(false)

  useEffect(() => {
    if (open) {
      setCategories(userCategories.map((c) => ({ ...c }))) // evita mutar o contexto
      fetchBenchmarks()
    }
  }, [open, userCategories])

  const fetchBenchmarks = async () => {
    try {
      const { data } = await api.get<BenchmarkOption[]>(MARKET_DATA_SERIES_ROUTES.list)
      setBenchmarks(data)
    } catch (err) {
      console.error('Erro ao carregar benchmarks', err)
    }
  }

  const handleChange = (index: number, field: keyof Category, value: any) => {
    const updated = [...categories]
    ;(updated[index] as any)[field] = value
    setCategories(updated)
  }

  const handleAdd = () => {
    setCategories([
      ...categories,
      {
        name: '',
        portfolio_id: selectedPortfolio?.id,
        color: '#000000',
        benchmark_id: null,
        id: null,
      },
    ])
  }

  const handleDelete = async (index: number) => {
    if (categories.length === 1) {
      setError('É necessário manter pelo menos uma categoria.')
      setSnackbarOpen(true)
      setConfirmDelete(null)
      return
    }
    const category = categories[index]
    if (category.id) {
      try {
        await api.delete(CATEGORY_ROUTES.byId(category.id), {
          data: { portfolio_id: selectedPortfolio?.id },
        })
        if (selectedPortfolio) {
          await refreshPortfolio()
        }
      } catch (err) {
        console.error('Erro ao deletar categoria', err)
        setError('Erro ao deletar categoria')
        setSnackbarOpen(true)
        return
      }
    }

    setCategories(categories.filter((_, i) => i !== index))
    setConfirmDelete(null)
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      await api.post(CATEGORY_ROUTES.save, { categories })
      await refreshPortfolio()
      setSuccessOpen(true)
      if (onSave) onSave()
    } catch (err) {
      console.error('Erro ao salvar categorias', err)
      setError('Erro ao salvar categorias.')
      setSnackbarOpen(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <AppFormDrawer
        open={open}
        onClose={onClose}
        title={`Editar Categorias - Carteira: ${selectedPortfolio?.name ?? ''}`}
        width="lg"
        submitLabel="Salvar Alterações"
        onSubmit={handleSave}
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
                onClick={() => setConfirmDelete(index)}
              >
                <DeleteIcon />
              </AppIconButton>
            </AppStack>
          </AppStack>
        ))}

        <AppButton emphasis="outline" fullWidth icon={<AddIcon />} onClick={handleAdd}>
          Adicionar Categoria
        </AppButton>
      </AppFormDrawer>

      <AppConfirmDialog
        open={confirmDelete !== null}
        title="Confirmar Exclusão"
        confirmLabel="Excluir"
        onConfirm={() => handleDelete(confirmDelete!)}
        onCancel={() => setConfirmDelete(null)}
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
        message="Categorias salvas com sucesso!"
        severity="success"
        onClose={() => setSuccessOpen(false)}
      />
    </>
  )
}
