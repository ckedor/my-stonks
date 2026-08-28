import {
    AppButton,
    AppConfirmDialog,
    AppCrudForm,
    AppCrudTable,
    AppSnackbar,
    AppStack,
    AppText,
    type ColumnConfig,
    type FieldConfig,
    PageTitle,
} from '@/components/ui'
import CrudPageSkeleton from '../CrudPageSkeleton'
import {
    createWealthTier,
    deleteWealthTier,
    fetchWealthTiers,
    updateWealthTier,
} from '@/api/wealth-tier'
import type { WealthTier } from '@/types'
import AddIcon from '@mui/icons-material/Add'
import { useEffect, useState } from 'react'

/* A escala de patentes.
 *
 * A quantidade de degraus é dado: esta tela é o único lugar que a define, e
 * nada no app assume um número ou um nome. Um degrau novo passa a valer para
 * todas as carteiras na hora, inclusive retroativamente — a patente é lida do
 * pico histórico do patrimônio, então repreçar aqui reavalia todo mundo pela
 * mesma régua em vez de congelar quem já tinha subido. */

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

export default function AdminWealthTiersPage() {
  const [tiers, setTiers] = useState<WealthTier[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selected, setSelected] = useState<WealthTier | null>(null)
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  })

  useEffect(() => {
    loadTiers()
  }, [])

  const loadTiers = async () => {
    setLoading(true)
    try {
      setTiers(await fetchWealthTiers())
    } catch (error) {
      console.error('Erro ao buscar patentes:', error)
      setSnackbar({ open: true, message: 'Erro ao carregar patentes', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setSelected(null)
    setFormOpen(true)
  }

  const handleEdit = (tier: WealthTier) => {
    setSelected(tier)
    setFormOpen(true)
  }

  const handleDelete = (tier: WealthTier) => {
    setSelected(tier)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!selected) return
    try {
      await deleteWealthTier(selected.id)
      setSnackbar({ open: true, message: 'Patente excluída com sucesso', severity: 'success' })
      loadTiers()
    } catch (error) {
      console.error('Erro ao excluir:', error)
      setSnackbar({ open: true, message: 'Erro ao excluir patente', severity: 'error' })
    } finally {
      setDeleteDialogOpen(false)
      setSelected(null)
    }
  }

  const handleSave = async (data: WealthTier) => {
    const payload = {
      rank: Number(data.rank),
      name: data.name,
      threshold: Number(data.threshold),
      artwork: data.artwork || null,
      artwork_offset: Number(data.artwork_offset) || 0,
      /* Zero significa "sem altura própria", e não uma arte de zero pixel: o
         campo vazio do formulário chega como 0 e tem que virar ausência. */
      artwork_height: Number(data.artwork_height) || null,
    }
    try {
      if (selected) {
        await updateWealthTier(selected.id, payload)
        setSnackbar({ open: true, message: 'Patente atualizada com sucesso', severity: 'success' })
      } else {
        await createWealthTier(payload)
        setSnackbar({ open: true, message: 'Patente criada com sucesso', severity: 'success' })
      }
      loadTiers()
    } catch (error) {
      console.error('Erro ao salvar:', error)
      throw error
    }
  }

  const columns: ColumnConfig[] = [
    { field: 'rank', label: 'Ordem', align: 'center' },
    { field: 'name', label: 'Patente' },
    {
      field: 'threshold',
      label: 'Patrimônio mínimo',
      align: 'right',
      format: (value) => currency.format(value),
    },
    {
      field: 'artwork',
      label: 'Arte',
      align: 'center',
      /* Sempre `<img>`, nunca marcação injetada: um SVG pode trazer script, e
         injetá-lo o faria rodar dentro do admin. */
      format: (value) => (value ? <img src={value} alt="" height={40} /> : '—'),
    },
    {
      field: 'artwork_offset',
      label: 'Ajuste',
      align: 'right',
      format: (value, row) =>
        row?.artwork ? `${value > 0 ? '+' : ''}${value}px` : '—',
    },
  ]

  const fields: FieldConfig[] = [
    { name: 'rank', label: 'Ordem', type: 'number', required: true },
    { name: 'name', label: 'Patente', type: 'text', required: true },
    { name: 'threshold', label: 'Patrimônio mínimo (R$)', type: 'number', required: true },
    { name: 'artwork', label: 'Arte do personagem (PNG ou SVG)', type: 'image' },
    { name: 'artwork_height', label: 'Altura da arte (px)', type: 'number' },
    { name: 'artwork_offset', label: 'Ajuste vertical da arte (px)', type: 'number' },
  ]

  if (loading) {
    return <CrudPageSkeleton columns={columns.length + 1} search={false} description rows={6} />
  }

  return (
    <>
      <AppStack gap="lg">
        <AppStack direction="row" justify="between" align="center">
          <PageTitle>Patentes</PageTitle>
          <AppButton icon={<AddIcon />} onClick={handleCreate}>
            Nova Patente
          </AppButton>
        </AppStack>

        <AppText variant="bodySmall" tone="secondary">
          A patente de uma carteira vem do maior patrimônio que ela já teve: um degrau
          é alcançado uma vez e não regride. Já o quanto falta para o próximo é medido
          pelo patrimônio de hoje. Mudar um valor aqui reavalia todas as carteiras.
          A altura e o ajuste vertical são por arte, porque cada arquivo põe o
          personagem numa altura diferente: valor negativo sobe o desenho.
        </AppText>

        <AppCrudTable
          data={tiers}
          columns={columns}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </AppStack>

      <AppCrudForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        title={selected ? 'Editar Patente' : 'Nova Patente'}
        fields={fields}
        initialData={selected}
        isEdit={!!selected}
      />

      <AppConfirmDialog
        open={deleteDialogOpen}
        title="Confirmar Exclusão"
        confirmLabel="Excluir"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      >
        Tem certeza que deseja excluir a patente <strong>{selected?.name}</strong>?
        Quem estiver nela passa para a patente abaixo. Esta ação não pode ser desfeita.
      </AppConfirmDialog>

      <AppSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      />
    </>
  )
}
