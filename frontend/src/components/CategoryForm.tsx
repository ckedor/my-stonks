
// components/CategoryForm.tsx
import { syncPortfolios } from '@/actions/portfolio'
import { CATEGORY_ROUTES, INDEX_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import { usePortfolioStore } from '@/stores/portfolio'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
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
  const selectedPortfolio = usePortfolioStore(s => s.selectedPortfolio)
  const userCategories = selectedPortfolio?.custom_categories ?? []

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
      const { data } = await api.get<BenchmarkOption[]>(INDEX_ROUTES.list)
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
      await syncPortfolios(true)
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
      <Drawer anchor="right" open={open} onClose={onClose}>
        <Box p={3} width={600} display="flex" flexDirection="column" height="100%">
          <Typography variant="h6" mb={2}>
            Editar Categorias - Carteira: {selectedPortfolio?.name}
          </Typography>

          <Stack spacing={2} flex={1} overflow="auto">
            {categories.map((cat, index) => (
              <Box key={index} display="flex" alignItems="center" gap={2}>
                <TextField
                  sx={{ flex: 2 }}
                  value={cat.name}
                  onChange={(e) => handleChange(index, 'name', e.target.value)}
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
                  <IconButton onClick={() => setConfirmDelete(index)}>
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </Box>
            ))}
            <Box mt={2}>
              <Button fullWidth variant="outlined" startIcon={<AddIcon />} onClick={handleAdd}>
                Adicionar Categoria
              </Button>
            </Box>
          </Stack>

          <Box mt={2}>
            <Button
              variant="contained"
              fullWidth
              onClick={handleSave}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
            >
              Salvar Alterações
            </Button>
          </Box>
        </Box>
      </Drawer>

      <Dialog open={confirmDelete !== null} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>Confirmar Exclusão</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Tem certeza que deseja excluir esta categoria? Essa ação não poderá ser desfeita.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancelar</Button>
          <Button color="error" onClick={() => handleDelete(confirmDelete!)} autoFocus>
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
          Categorias salvas com sucesso!
        </Alert>
      </Snackbar>
    </>
  )
}
