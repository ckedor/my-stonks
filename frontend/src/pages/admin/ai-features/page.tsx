import {
    fetchAIFeatures,
    updateAIFeature,
    type AIFeature,
} from '@/api/ai'
import CrudForm, { FieldConfig } from '@/components/admin/CrudForm'
import CrudTable, { ColumnConfig } from '@/components/admin/CrudTable'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import {
    Alert,
    Box,
    Snackbar,
    Stack,
    Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'

export default function AdminAIFeaturesPage() {
  const [features, setFeatures] = useState<AIFeature[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [selected, setSelected] = useState<AIFeature | null>(null)
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      setFeatures(await fetchAIFeatures())
    } catch {
      showSnackbar('Erro ao carregar features', 'error')
    } finally {
      setLoading(false)
    }
  }

  const showSnackbar = (message: string, severity: 'success' | 'error') =>
    setSnackbar({ open: true, message, severity })

  const handleEdit = (feature: AIFeature) => {
    setSelected(feature)
    setFormOpen(true)
  }

  const handleSave = async (data: Record<string, unknown>) => {
    try {
      if (!selected) return
      await updateAIFeature(selected.id, {
        default_ttl_hours: Number(data.default_ttl_hours),
      })
      showSnackbar('Feature atualizada com sucesso', 'success')
      loadData()
    } catch {
      throw new Error('Erro ao salvar feature')
    }
  }

  const columns: ColumnConfig[] = [
    { field: 'id', label: 'ID', align: 'center' },
    { field: 'key', label: 'Key' },
    { field: 'default_ttl_hours', label: 'TTL (horas)', align: 'center' },
    { field: 'created_at', label: 'Criado em', format: (v) => new Date(v as string).toLocaleString('pt-BR') },
    { field: 'updated_at', label: 'Atualizado em', format: (v) => new Date(v as string).toLocaleString('pt-BR') },
  ]

  const fields: FieldConfig[] = [
    { name: 'default_ttl_hours', label: 'TTL padrão (horas)', type: 'text', required: true },
  ]

  if (loading) return <LoadingSpinner />

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">AI Features</Typography>
      </Stack>

      <CrudTable data={features} columns={columns} onEdit={handleEdit} />

      <CrudForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        title={'Editar Feature'}
        fields={fields}
        initialData={selected}
        isEdit={!!selected}
      />

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
