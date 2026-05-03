
import { syncPortfolios } from '@/actions/portfolio'
import { CATEGORY_ROUTES, INDEX_ROUTES, PORTFOLIO_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import { usePortfolioStore } from '@/stores/portfolio'
import { Delete } from '@mui/icons-material'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Drawer,
    IconButton,
    MenuItem,
    Select,
    Snackbar,
    Stack,
    TextField,
    Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'

interface BenchmarkOption {
  id: number
  short_name: string
}

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
  const selectedPortfolio = usePortfolioStore(s => s.selectedPortfolio)

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
      const { data } = await api.get<BenchmarkOption[]>(INDEX_ROUTES.list)
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
      <Drawer anchor="right" open={open} onClose={onClose}>
        <Box p={3} width={600} display="flex" flexDirection="column" height="100%">
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">{isEdit ? `Editar Carteira` : 'Nova Carteira'}</Typography>
            {isEdit && (
              <IconButton onClick={() => setConfirmDelete(true)}>
                <Delete />
              </IconButton>
            )}
          </Box>

          <TextField
            label="Nome da Carteira"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
          />

          <Typography variant="subtitle1" mb={1}>
            Categorias
          </Typography>
          <Stack spacing={2} flex={1} overflow="auto">
            {categories.map((cat, index) => (
              <Box key={index} display="flex" alignItems="center" gap={2}>
                <TextField
                  value={cat.name}
                  onChange={(e) => handleChange(index, 'name', e.target.value)}
                  sx={{ flex: 2 }}
                />
                <Select
                  value={cat.benchmark_id ?? ''}
                  onChange={(e) =>
                    handleChange(
                      index,
                      'benchmark_id',
                      !e.target.value ? null : Number(e.target.value)
                    )
                  }
                  displayEmpty
                  sx={{ flex: 1.5, minWidth: 150 }}
                >
                  <MenuItem value="">Sem Benchmark</MenuItem>
                  {benchmarks.map((b) => (
                    <MenuItem key={b.id} value={b.id}>
                      {b.short_name}
                    </MenuItem>
                  ))}
                </Select>
                <Box display="flex" alignItems="center" gap={1}>
                  <input
                    type="color"
                    value={cat.color}
                    onChange={(e) => handleChange(index, 'color', e.target.value)}
                    style={{ width: 36, height: 36, border: 'none', cursor: 'pointer' }}
                  />
                  <IconButton onClick={() => setConfirmDeleteCategory(index)}>
                    <Delete />
                  </IconButton>
                </Box>
              </Box>
            ))}
            <Box mt={2}>
              <Button fullWidth variant="outlined" onClick={handleAdd}>
                Adicionar Categoria
              </Button>
            </Box>
          </Stack>

          <Box mt={2}>
            <Button
              variant="contained"
              fullWidth
              onClick={handleSave}
              disabled={loading || !name.trim()}
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
            >
              {isEdit ? 'Salvar Alterações' : 'Criar Carteira'}
            </Button>
          </Box>
        </Box>
      </Drawer>

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <DialogTitle>Confirmar Exclusão</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Tem certeza que deseja excluir esta carteira? Todas as transações, posições e dividendos
            associados a ela serão removidos. Essa ação não poderá ser desfeita.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(false)}>Cancelar</Button>
          <Button color="error" onClick={handleDeletePortfolio} autoFocus>
            Excluir
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmDeleteCategory !== null} onClose={() => setConfirmDeleteCategory(null)}>
        <DialogTitle>Confirmar Exclusão</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Tem certeza que deseja excluir esta categoria? Essa ação não poderá ser desfeita.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteCategory(null)}>Cancelar</Button>
          <Button color="error" onClick={deleteCategory} autoFocus>
            Excluir
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={5000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setSnackbarOpen(false)}>
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={successOpen}
        autoHideDuration={4000}
        onClose={() => setSuccessOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSuccessOpen(false)}>
          {isEdit ? 'Carteira atualizada!' : 'Carteira criada com sucesso!'}
        </Alert>
      </Snackbar>
    </>
  )
}
