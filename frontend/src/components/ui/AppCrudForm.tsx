/* Formulário em drawer, dirigido por uma lista de campos.
 *
 * Mesmo caso do AppCrudTable: recebe `fields` e um `onSave`, sem nenhuma
 * noção de domínio, então é design system e não componente de admin. */

import {
    Box,
    Button,
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
  /** `image` sobe um arquivo e guarda a data URI dele — não um caminho nem um
   *  identificador de storage. A imagem vira texto, então viaja e é gravada
   *  como qualquer outro campo do formulário. */
  type: 'text' | 'number' | 'select' | 'image'
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
  /* Um save que falha em silêncio é pior que um que estoura: o drawer fica
     aberto, o botão volta ao normal e nada indica que a gravação não
     aconteceu. O erro do backend é o que a tela precisa mostrar. */
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setSaveError(null)
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
    setSaveError(null)
    try {
      await onSave(formData)
      onClose()
    } catch (error: any) {
      console.error('Erro ao salvar:', error)
      /* `message` é o corpo de erro da aplicação; `detail` é o do FastAPI para
         payload inválido. Os dois aparecem, então a tela lê os dois. */
      const body = error?.response?.data
      setSaveError(
        body?.message ??
          (typeof body?.detail === 'string' ? body.detail : null) ??
          error?.message ??
          'Não foi possível salvar. Tente novamente.',
      )
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
            if (field.type === 'image') {
              return (
                <ImageField
                  key={field.name}
                  label={field.label}
                  value={formData[field.name] || ''}
                  disabled={field.disabled}
                  onChange={(svg) => handleChange(field.name, svg)}
                />
              )
            }

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
          {saveError && (
            <Typography variant="body2" color="error" sx={{ mb: 1 }}>
              {saveError}
            </Typography>
          )}
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

/* Campo de upload de imagem.

   Guarda a data URI do arquivo: não existe caminho, bucket nem volume
   envolvido, e por isso a arte funciona igual em qualquer ambiente. PNG e SVG
   são igualmente bem-vindos — pixel art é raster por natureza e não ganha nada
   ao virar vetor.

   A prévia usa a mesma string que será gravada, e sempre por `<img>`. Um SVG
   pode trazer `<script>`; dentro de `<img>` ele não roda, e o backend recusa o
   arquivo na gravação. */
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/svg+xml', 'image/webp', 'image/gif']

function ImageField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: string
  disabled?: boolean
  onChange: (dataUri: string) => void
}) {
  const [error, setError] = useState<string | null>(null)

  const handleFile = (file: File | undefined) => {
    if (!file) return
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError('Use PNG, SVG, WebP ou GIF.')
      return
    }
    const reader = new FileReader()
    reader.onerror = () => setError('Não foi possível ler o arquivo.')
    reader.onload = () => {
      setError(null)
      onChange(String(reader.result))
    }
    reader.readAsDataURL(file)
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="body2" sx={{ mb: 1 }}>
        {label}
      </Typography>
      <AppStack direction="row" gap="md" align="center">
        {value && (
          <Box
            component="img"
            src={value}
            alt=""
            sx={{ height: 72, width: 'auto', objectFit: 'contain' }}
          />
        )}
        <AppStack gap="xs">
          {/* `Button` do MUI e não `AppButton`: só ele aceita virar `label`,
              que é o que faz o clique abrir o seletor de arquivo. Isto é design
              system, a única camada autorizada a chegar no MUI. */}
          <Button variant="text" component="label" disabled={disabled}>
            {value ? 'Trocar arquivo' : 'Escolher arquivo'}
            <input
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(',')}
              hidden
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </Button>
          {value && (
            <Button variant="text" color="error" disabled={disabled} onClick={() => onChange('')}>
              Remover
            </Button>
          )}
        </AppStack>
      </AppStack>
      {error && (
        <Typography variant="caption" color="error">
          {error}
        </Typography>
      )}
    </Box>
  )
}
