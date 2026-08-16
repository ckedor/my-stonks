/* Formulário em drawer, dirigido por uma lista de campos.
 *
 * Mesmo caso do AppCrudTable: recebe `fields` e um `onSave`, sem nenhuma
 * noção de domínio, então é design system e não componente de admin. */

import {
    Box,
    Divider,
    Drawer,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import AppButton from './AppButton'
import AppStack from './AppStack'

export interface FieldConfig {
  name: string
  label: string
  type: 'text' | 'number' | 'select'
  required?: boolean
  options?: Array<{ value: any; label: string }>
  disabled?: boolean
}

export interface AppCrudFormProps {
  open: boolean
  onClose: () => void
  onSave: (data: any) => Promise<void>
  title: string
  fields: FieldConfig[]
  initialData?: any
  isEdit?: boolean
  onFieldChange?: (name: string, value: any) => void
}

export default function AppCrudForm({
  open,
  onClose,
  onSave,
  title,
  fields,
  initialData,
  isEdit = false,
  onFieldChange,
}: AppCrudFormProps) {
  const [formData, setFormData] = useState<any>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      if (initialData) {
        setFormData(initialData)
      } else {
        // Initialize with empty values
        const emptyData: any = {}
        fields.forEach((field) => {
          emptyData[field.name] = field.type === 'number' ? 0 : ''
        })
        setFormData(emptyData)
      }
    }
  }, [open, initialData, fields])

  const handleChange = (name: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [name]: value }))
    onFieldChange?.(name, value)
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await onSave(formData)
      onClose()
    } catch (error) {
      console.error('Erro ao salvar:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: { xs: '100vw', sm: 500 }, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6">{title}</Typography>
        </Box>

        <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 3 }}>
          {fields.map((field) => {
            if (field.type === 'select') {
              return (
                <FormControl key={field.name} fullWidth margin="normal" required={field.required}>
                  <InputLabel>{field.label}</InputLabel>
                  <Select
                    value={formData[field.name] || ''}
                    label={field.label}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    disabled={field.disabled}
                  >
                    {field.options?.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )
            }

            return (
              <TextField
                key={field.name}
                label={field.label}
                type={field.type}
                value={formData[field.name] || ''}
                onChange={(e) =>
                  handleChange(
                    field.name,
                    field.type === 'number' ? Number(e.target.value) : e.target.value
                  )
                }
                fullWidth
                margin="normal"
                required={field.required}
                disabled={field.disabled}
              />
            )
          })}
        </Box>

        {/* Footer Actions */}
        <Divider />
        <Box sx={{ p: 2 }}>
          <AppStack direction="row" gap="md" justify="end">
            <AppButton emphasis="ghost" onClick={onClose} disabled={loading}>
              Cancelar
            </AppButton>
            <AppButton onClick={handleSubmit} disabled={loading}>
              {loading ? 'Salvando...' : isEdit ? 'Atualizar' : 'Criar'}
            </AppButton>
          </AppStack>
        </Box>
      </Box>
    </Drawer>
  )
}
