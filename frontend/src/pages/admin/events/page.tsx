import CrudForm, { FieldConfig } from '@/components/admin/CrudForm'
import CrudTable, { ColumnConfig } from '@/components/admin/CrudTable'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { ASSET_ROUTES } from '@/constants/routes'
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

interface AssetEvent {
  id: number
  asset_id: number
  date: string
  factor: number
  type: string
}

interface Asset {
  id: number
  ticker: string
}

const EVENT_TYPE_OPTIONS = [
  { value: 'SPLIT', label: 'Split' },
  { value: 'REVERSE_SPLIT', label: 'Grupamento' },
  { value: 'BONUS', label: 'Bonificação' },
  { value: 'CONVERSION', label: 'Conversão' },
]

const eventTypeLabel = (type: string) =>
  EVENT_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type

export default function AdminEventsPage() {
  const [events, setEvents] = useState<AssetEvent[]>([])
  const [filteredEvents, setFilteredEvents] = useState<AssetEvent[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)

  const showLoading = loading
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<AssetEvent | null>(null)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' })

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (search.trim() === '') {
      setFilteredEvents(events)
    } else {
      const searchLower = search.toLowerCase()
      setFilteredEvents(
        events.filter(
          (e) => {
            const ticker = assets.find((a) => a.id === e.asset_id)?.ticker ?? ''
            return (
              ticker.toLowerCase().includes(searchLower) ||
              eventTypeLabel(e.type).toLowerCase().includes(searchLower) ||
              e.date?.includes(searchLower)
            )
          },
        ),
      )
    }
  }, [search, events, assets])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [eventsRes, assetsRes] = await Promise.all([
        api.get(ASSET_ROUTES.event),
        api.get(ASSET_ROUTES.list),
      ])
      setEvents(eventsRes.data)
      setFilteredEvents(eventsRes.data)
      setAssets(assetsRes.data)
    } catch (error) {
      console.error('Erro ao buscar dados:', error)
      setSnackbar({ open: true, message: 'Erro ao carregar dados', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setSelectedEvent(null)
    setFormOpen(true)
  }

  const handleEdit = (event: AssetEvent) => {
    setSelectedEvent(event)
    setFormOpen(true)
  }

  const handleDelete = (event: AssetEvent) => {
    setSelectedEvent(event)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!selectedEvent) return
    try {
      await api.delete(ASSET_ROUTES.eventById(selectedEvent.id))
      setSnackbar({ open: true, message: 'Evento excluído com sucesso', severity: 'success' })
      fetchData()
    } catch (error) {
      console.error('Erro ao excluir:', error)
      setSnackbar({ open: true, message: 'Erro ao excluir evento', severity: 'error' })
    } finally {
      setDeleteDialogOpen(false)
      setSelectedEvent(null)
    }
  }

  const handleSave = async (data: any) => {
    try {
      if (selectedEvent) {
        await api.put(ASSET_ROUTES.eventById(selectedEvent.id), data)
        setSnackbar({ open: true, message: 'Evento atualizado com sucesso', severity: 'success' })
      } else {
        await api.post(ASSET_ROUTES.event, data)
        setSnackbar({ open: true, message: 'Evento criado com sucesso', severity: 'success' })
      }
      fetchData()
    } catch (error) {
      console.error('Erro ao salvar:', error)
      throw error
    }
  }

  const assetTickerMap = Object.fromEntries(assets.map((a) => [a.id, a.ticker]))

  const columns: ColumnConfig[] = [
    { field: 'id', label: 'ID', align: 'center' },
    {
      field: 'asset_id',
      label: 'Ativo',
      format: (value) => assetTickerMap[value] || String(value),
    },
    {
      field: 'type',
      label: 'Tipo',
      format: (value) => eventTypeLabel(value),
    },
    {
      field: 'date',
      label: 'Data',
      format: (value) => {
        if (!value) return '—'
        const [y, m, d] = value.split('-')
        return `${d}/${m}/${y}`
      },
    },
    {
      field: 'factor',
      label: 'Fator',
      align: 'center',
      format: (value) => (value != null ? String(value) : '—'),
    },
  ]

  const fields: FieldConfig[] = [
    {
      name: 'asset_id',
      label: 'Ativo',
      type: 'select',
      required: true,
      options: assets.map((a) => ({ value: a.id, label: a.ticker })),
    },
    {
      name: 'type',
      label: 'Tipo de Evento',
      type: 'select',
      required: true,
      options: EVENT_TYPE_OPTIONS,
    },
    { name: 'date', label: 'Data (YYYY-MM-DD)', type: 'text', required: true },
    { name: 'factor', label: 'Fator', type: 'number', required: true },
  ]

  if (showLoading) {
    return <LoadingSpinner />
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">Gerenciamento de Eventos</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
          Novo Evento
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
        placeholder="Busque por ativo, tipo ou data..."
      />

      <CrudTable
        data={filteredEvents}
        columns={columns}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <CrudForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        title={selectedEvent ? 'Editar Evento' : 'Novo Evento'}
        fields={fields}
        initialData={selectedEvent}
        isEdit={!!selectedEvent}
      />

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirmar Exclusão</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Tem certeza que deseja excluir o evento de <strong>{assetTickerMap[selectedEvent?.asset_id ?? 0] ?? ''} — {eventTypeLabel(selectedEvent?.type ?? '')}</strong>?
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
