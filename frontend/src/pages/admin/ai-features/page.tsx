import {
    fetchAIFeatures,
    updateAIFeature,
    type AIFeature,
} from '@/api/ai'
import {
    AppCrudForm,
    AppCrudTable,
    AppSnackbar,
    AppStack,
    type ColumnConfig,
    type FieldConfig,
    PageTitle,
} from '@/components/ui'
import CrudPageSkeleton from '../CrudPageSkeleton'
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

  if (loading) return <CrudPageSkeleton columns={columns.length + 1} action={false} search={false} rows={6} />

  return (
    <>
      <AppStack gap="lg">
        <PageTitle>AI Features</PageTitle>

        <AppCrudTable data={features} columns={columns} onEdit={handleEdit} />
      </AppStack>

      <AppCrudForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        title={'Editar Feature'}
        fields={fields}
        initialData={selected}
        isEdit={!!selected}
      />

      <AppSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      />
    </>
  )
}
