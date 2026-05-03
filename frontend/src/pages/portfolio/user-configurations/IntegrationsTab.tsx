import { USER_CONFIGURATION_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import { usePortfolioStore } from '@/stores/portfolio'
import {
    Alert,
    CircularProgress,
    FormControlLabel,
    Snackbar,
    Stack,
    Switch,
    Typography,
} from '@mui/material'
import { JSX, useEffect, useState } from 'react'

type UserConfiguration = {
  id: number
  portfolio_id: number
  name: string
  enabled: boolean
  config_data: Record<string, unknown>
}

const CONFIG_LABELS: Record<string, JSX.Element> = {
  foxbit_integration: (
    <Typography variant="body1">
      <strong>Integração com Foxbit:</strong> Atualização de transações de criptomoeda na corretora
      Foxbit
    </Typography>
  ),
  fiis_dividends_integration: (
    <Typography variant="body1">
      <strong>Dividendos de FIIs:</strong> Atualização automática dos dividendos pagos pelos FIIs em
      carteira
    </Typography>
  ),
}

export default function IntegrationsTab() {
  const selectedPortfolio = usePortfolioStore(s => s.selectedPortfolio)

  const [configurations, setConfigurations] = useState<UserConfiguration[]>([])
  const [loading, setLoading] = useState(true)
  const [snackbar, setSnackbar] = useState<{ message: string; type: 'success' | 'error' } | null>(
    null,
  )

  useEffect(() => {
    if (!selectedPortfolio?.id) return
    fetchConfigurations()
  }, [selectedPortfolio])

  const fetchConfigurations = async () => {
    setLoading(true)
    try {
      const res = await api.get(USER_CONFIGURATION_ROUTES.byPortfolio(selectedPortfolio?.id ?? ''))
      setConfigurations(res.data.configurations)
    } catch (err) {
      console.log('Erro ao carregar configurações:', err)
      setSnackbar({ message: 'Erro ao carregar configurações', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (name: string, enabled: boolean) => {
    try {
      await api.put(USER_CONFIGURATION_ROUTES.byPortfolio(selectedPortfolio?.id ?? ''), {
        configuration: name,
        enabled: !enabled,
      })
      setConfigurations((prev) =>
        prev.map((c) => (c.name === name ? { ...c, enabled: !enabled } : c)),
      )
      setSnackbar({ message: 'Configuração atualizada', type: 'success' })
    } catch {
      setSnackbar({ message: 'Erro ao atualizar configuração', type: 'error' })
    }
  }

  if (loading) {
    return <CircularProgress sx={{ mt: 4, mx: 'auto', display: 'block' }} />
  }

  return (
    <>
      <Stack spacing={3} maxWidth={600}>
        {configurations.map((config) => (
          <FormControlLabel
            key={config.name}
            control={
              <Switch
                checked={config.enabled}
                onChange={() => handleToggle(config.name, config.enabled)}
              />
            }
            label={CONFIG_LABELS[config.name] ?? config.name}
            labelPlacement="end"
            sx={{
              alignItems: 'flex-start',
              '& .MuiFormControlLabel-label': { mt: '2px' },
            }}
          />
        ))}
        {configurations.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Nenhuma configuração disponível
          </Typography>
        )}
      </Stack>

      <Snackbar
        open={!!snackbar}
        autoHideDuration={3000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar?.type} variant="filled" onClose={() => setSnackbar(null)}>
          {snackbar?.message}
        </Alert>
      </Snackbar>
    </>
  )
}
