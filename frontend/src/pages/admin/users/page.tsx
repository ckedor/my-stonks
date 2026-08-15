import CrudForm, { FieldConfig } from '@/components/admin/CrudForm'
import CrudTable, { ColumnConfig } from '@/components/admin/CrudTable'
import {
    AppButton,
    AppChip,
    AppConfirmDialog,
    AppSearchField,
    AppSnackbar,
    AppStack,
    LoadingSpinner,
    PageTitle,
} from '@/components/ui'
import { AUTH_ROUTES, USER_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import AddIcon from '@mui/icons-material/Add'
import { useEffect, useState } from 'react'

interface User {
  id: number
  username: string
  email: string
  is_active: boolean
  is_superuser: boolean
  is_verified: boolean
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' })

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (search.trim() === '') {
      setFilteredUsers(users)
    } else {
      const s = search.toLowerCase()
      setFilteredUsers(
        users.filter((u) => u.username.toLowerCase().includes(s) || u.email.toLowerCase().includes(s)),
      )
    }
  }, [search, users])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await api.get(USER_ROUTES.list)
      setUsers(res.data)
      setFilteredUsers(res.data)
    } catch (error) {
      console.error('Erro ao buscar dados:', error)
      setSnackbar({ open: true, message: 'Erro ao carregar dados', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setSelectedUser(null)
    setFormOpen(true)
  }

  const handleEdit = (user: User) => {
    setSelectedUser(user)
    setFormOpen(true)
  }

  const handleDelete = (user: User) => {
    setSelectedUser(user)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!selectedUser) return
    try {
      await api.delete(USER_ROUTES.byId(selectedUser.id))
      setSnackbar({ open: true, message: 'Usuário excluído com sucesso', severity: 'success' })
      fetchData()
    } catch (error) {
      console.error('Erro ao excluir:', error)
      setSnackbar({ open: true, message: 'Erro ao excluir usuário', severity: 'error' })
    } finally {
      setDeleteDialogOpen(false)
      setSelectedUser(null)
    }
  }

  const handleSave = async (data: Record<string, unknown>) => {
    try {
      if (selectedUser) {
        await api.patch(USER_ROUTES.byId(selectedUser.id), {
          username: data.username,
          email: data.email,
          is_active: data.is_active,
          is_superuser: data.is_superuser,
          is_verified: data.is_verified,
        })
        setSnackbar({ open: true, message: 'Usuário atualizado com sucesso', severity: 'success' })
      } else {
        await api.post(AUTH_ROUTES.register, {
          username: data.username,
          email: data.email,
          password: data.password,
          is_active: true,
          is_superuser: data.is_superuser ?? false,
          is_verified: true,
        })
        setSnackbar({ open: true, message: 'Usuário criado com sucesso', severity: 'success' })
      }
      fetchData()
    } catch (error) {
      console.error('Erro ao salvar:', error)
      throw error
    }
  }

  const boolOptions = [
    { value: true, label: 'Sim' },
    { value: false, label: 'Não' },
  ]

  const columns: ColumnConfig[] = [
    { field: 'id', label: 'ID', align: 'center' },
    { field: 'username', label: 'Username' },
    { field: 'email', label: 'Email' },
    {
      field: 'is_active',
      label: 'Ativo',
      align: 'center',
      format: (v) => <AppChip label={v ? 'Sim' : 'Não'} tone={v ? 'success' : 'neutral'} />,
    },
    {
      field: 'is_superuser',
      label: 'Admin',
      align: 'center',
      format: (v) => <AppChip label={v ? 'Sim' : 'Não'} tone={v ? 'primary' : 'neutral'} />,
    },
    {
      field: 'is_verified',
      label: 'Verificado',
      align: 'center',
      format: (v) => <AppChip label={v ? 'Sim' : 'Não'} tone={v ? 'info' : 'neutral'} />,
    },
  ]

  const fields: FieldConfig[] = selectedUser
    ? [
        { name: 'username', label: 'Username', type: 'text', required: true },
        { name: 'email', label: 'Email', type: 'text', required: true },
        { name: 'is_active', label: 'Ativo', type: 'select', options: boolOptions },
        { name: 'is_superuser', label: 'Admin', type: 'select', options: boolOptions },
        { name: 'is_verified', label: 'Verificado', type: 'select', options: boolOptions },
      ]
    : [
        { name: 'username', label: 'Username', type: 'text', required: true },
        { name: 'email', label: 'Email', type: 'text', required: true },
        { name: 'password', label: 'Senha', type: 'text', required: true },
        { name: 'is_superuser', label: 'Admin', type: 'select', options: boolOptions },
      ]

  if (loading) return <LoadingSpinner />

  return (
    <>
      <AppStack gap="lg">
        <AppStack direction="row" justify="between" align="center">
          <PageTitle>Gerenciamento de Usuários</PageTitle>
          <AppButton icon={<AddIcon />} onClick={handleCreate}>
            Novo Usuário
          </AppButton>
        </AppStack>

        <AppStack gap="md">
          <AppSearchField
            value={search}
            onChange={setSearch}
            placeholder="Busque por username ou email..."
          />

          <CrudTable data={filteredUsers} columns={columns} onEdit={handleEdit} onDelete={handleDelete} />
        </AppStack>
      </AppStack>

      <CrudForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        title={selectedUser ? 'Editar Usuário' : 'Novo Usuário'}
        fields={fields}
        initialData={selectedUser}
        isEdit={!!selectedUser}
      />

      <AppConfirmDialog
        open={deleteDialogOpen}
        title="Confirmar Exclusão"
        confirmLabel="Excluir"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      >
        Tem certeza que deseja excluir o usuário <strong>{selectedUser?.username}</strong>? Esta ação
        não pode ser desfeita.
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
