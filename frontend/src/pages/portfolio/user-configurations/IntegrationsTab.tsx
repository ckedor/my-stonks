import {
  AppSnackbar,
  AppStack,
  AppStackItem,
  AppSwitch,
  AppText,
  LoadingSpinner,
} from '@/components/ui'
import { USER_CONFIGURATION_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import { usePortfolioStore } from '@/stores/portfolio'
import { useEffect, useState } from 'react'

/* `name` e `enabled` são o que toda configuração tem; o resto só existe depois
   que a carteira gravou uma escolha. Uma opção nunca tocada não tem linha no
   banco — ela aparece na lista como desligada, que é o padrão, e ganha id na
   primeira vez que alguém mexe no interruptor. */
type UserConfiguration = {
  id?: number
  portfolio_id?: number
  name: string
  enabled: boolean
  config_data?: Record<string, unknown>
}

const CONFIG_LABELS: Record<string, { title: string; description: string }> = {
  foxbit_integration: {
    title: 'Integração com Foxbit',
    description: 'Atualização de transações de criptomoeda na corretora Foxbit',
  },
  fiis_dividends_integration: {
    title: 'Dividendos de FIIs',
    description: 'Atualização automática dos dividendos pagos pelos FIIs em carteira',
  },
  wealth_tier_artwork: {
    title: 'Personagem da patente',
    description:
      'Mostra a ilustração da patente ao lado do patrimônio. A patente e a barra de progresso aparecem de qualquer jeito',
  },
}

export default function IntegrationsTab() {
  const selectedPortfolio = usePortfolioStore((s) => s.selectedPortfolio)

  const [configurations, setConfigurations] = useState<UserConfiguration[]>([])
  const [loading, setLoading] = useState(true)
  const [snackbar, setSnackbar] = useState<{ message: string; type: 'success' | 'error' } | null>(
    null
  )

  useEffect(() => {
    if (!selectedPortfolio?.id) return
    fetchConfigurations()
  }, [selectedPortfolio])

  const fetchConfigurations = async () => {
    setLoading(true)
    try {
      const res = await api.get(USER_CONFIGURATION_ROUTES.byPortfolio(selectedPortfolio?.id ?? ''))
      /* A lista sai de `nameOptions`, não das linhas gravadas: uma configuração
         que a carteira nunca tocou não tem linha no banco, e antes disso ela
         simplesmente não aparecia — não havia como ligar o que nunca foi
         ligado. Sem linha significa desligada, que é o padrão. */
      const saved: UserConfiguration[] = res.data.configurations
      setConfigurations(
        (res.data.nameOptions as string[]).map(
          (name) => saved.find((c) => c.name === name) ?? { name, enabled: false }
        )
      )
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
        prev.map((c) => (c.name === name ? { ...c, enabled: !enabled } : c))
      )
      setSnackbar({ message: 'Configuração atualizada', type: 'success' })
    } catch {
      setSnackbar({ message: 'Erro ao atualizar configuração', type: 'error' })
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <>
      <AppStack direction="row">
        <AppStackItem width={600}>
          <AppStack gap="lg">
            {configurations.map((config) => {
              const labels = CONFIG_LABELS[config.name]
              return (
                <AppSwitch
                  key={config.name}
                  label={labels?.title ?? config.name}
                  description={labels?.description}
                  checked={config.enabled}
                  onChange={() => handleToggle(config.name, config.enabled)}
                />
              )
            })}
            {configurations.length === 0 && (
              <AppText variant="bodySmall" tone="secondary">
                Nenhuma configuração disponível
              </AppText>
            )}
          </AppStack>
        </AppStackItem>
      </AppStack>

      <AppSnackbar
        open={!!snackbar}
        message={snackbar?.message ?? ''}
        severity={snackbar?.type ?? 'success'}
        onClose={() => setSnackbar(null)}
      />
    </>
  )
}
