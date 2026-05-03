import CrudForm, { FieldConfig } from '@/components/admin/CrudForm'
import CrudTable, { ColumnConfig } from '@/components/admin/CrudTable'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { BROKER_ROUTES, INDEX_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import AddIcon from '@mui/icons-material/Add'
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Snackbar,
    Stack,
    TextField,
    Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'

interface Broker {
  id: number
  name: string
  cnpj: string | null
  currency_id: number
  currency?: {
    id: number
    name: string
    code: string
  }
}

interface Currency {
  id: number
  name: string
  code: string
}

export default function AdminBrokersPage() {
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [filteredBrokers, setFilteredBrokers] = useState<Broker[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [loading, setLoading] = useState(true)

  const showLoading = loading
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedBroker, setSelectedBroker] = useState<Broker | null>(null)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' })

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (search.trim() === '') {
      setFilteredBrokers(brokers)
    } else {
      const searchLower = search.toLowerCase()
      setFilteredBrokers(
        brokers.filter(
          (b) =>
            b.name.toLowerCase().includes(searchLower) ||
            b.cnpj?.toLowerCase().includes(searchLower) ||
            b.currency?.name.toLowerCase().includes(searchLower)
        )
      )
    }
  }, [search, brokers])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [brokersRes, currenciesRes] = await Promise.all([
        api.get(BROKER_ROUTES.list),
        api.get(INDEX_ROUTES.currency),
      ])
      setBrokers(brokersRes.data)
      setFilteredBrokers(brokersRes.data)
      setCurrencies(currenciesRes.data)
    } catch (error) {
      console.error('Erro ao buscar dados:', error)
      setSnackbar({ open: true, message: 'Erro ao carregar dados', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setSelectedBroker(null)
    setFormOpen(true)
  }

  const handleEdit = (broker: Broker) => {
    setSelectedBroker(broker)
    setFormOpen(true)
  }

  const handleDelete = (broker: Broker) => {
    setSelectedBroker(broker)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!selectedBroker) return
    try {
      await api.delete(BROKER_ROUTES.byId(selectedBroker.id))
      setSnackbar({ open: true, message: 'Corretora excluída com sucesso', severity: 'success' })
      fetchData()
    } catch (error) {
      console.error('Erro ao excluir:', error)
      setSnackbar({ open: true, message: 'Erro ao excluir corretora', severity: 'error' })
    } finally {
      setDeleteDialogOpen(false)
      setSelectedBroker(null)
    }
  }

  const handleSave = async (data: any) => {
    try {
      if (selectedBroker) {
        await api.put(BROKER_ROUTES.byId(selectedBroker.id), data)
        setSnackbar({ open: true, message: 'Corretora atualizada com sucesso', severity: 'success' })
      } else {
        await api.post(BROKER_ROUTES.create, data)
        setSnackbar({ open: true, message: 'Corretora criada com sucesso', severity: 'success' })
      }
      fetchData()
    } catch (error) {
      console.error('Erro ao salvar:', error)
      throw error
    }
  }

  const columns: ColumnConfig[] = [
    { field: 'id', label: 'ID', align: 'center' },
    { field: 'name', label: 'Nome' },
    { field: 'cnpj', label: 'CNPJ', format: (value) => value || '—' },
    {
      field: 'currency',
      label: 'Moeda',
      format: (value) => (value ? `${value.name} (${value.code})` : '—'),
    },
  ]

  const fields: FieldConfig[] = [
    { name: 'name', label: 'Nome', type: 'text', required: true },
    { name: 'cnpj', label: 'CNPJ', type: 'text', required: false },
    {
      name: 'currency_id',
      label: 'Moeda',
      type: 'select',
      required: true,
      options: currencies.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` })),
    },
  ]

  if (showLoading) {
    return <LoadingSpinner />
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">Gerenciamento de Corretoras</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
          Nova Corretora
        </Button>
      </Stack>

      <TextField
        label="Buscar"
        variant="outlined"
        size="small"
        fullWidth
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 2, maxWidth: 400 }}
        placeholder="Busque por nome, CNPJ ou moeda..."
      />

      <CrudTable
        data={filteredBrokers}
        columns={columns}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <CrudForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        title={selectedBroker ? 'Editar Corretora' : 'Nova Corretora'}
        fields={fields}
        initialData={selectedBroker}
        isEdit={!!selectedBroker}
      />

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirmar Exclusão</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Tem certeza que deseja excluir a corretora <strong>{selectedBroker?.name}</strong>?
            Esta ação não pode ser desfeita.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Excluir
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
