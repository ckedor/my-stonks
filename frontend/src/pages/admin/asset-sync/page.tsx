import { AppSnackbar, AppStack, PageTitle } from '@/components/ui'
import { useState } from 'react'
import AssetCatalogueSync from '../assets/AssetCatalogueSync'

/* Sincronização do cadastro de ativos com o catálogo do provedor.
 *
 * Mora em Integrações e não na tela de Ativos: é uma chamada a um provedor
 * externo que pode cadastrar o mercado inteiro de uma classe, do mesmo tipo
 * das outras importações — e não parte do cadastro à mão que a tela de Ativos
 * é. */

export default function AdminAssetSyncPage() {
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  })

  return (
    <>
      <AppStack gap="lg">
        <PageTitle>Sincronização de ativos</PageTitle>
        <AssetCatalogueSync
          onApplied={(report) =>
            setSnackbar({
              open: true,
              message: `Catálogo aplicado: ${report.created.length} cadastrados, ${report.updated.length} corrigidos`,
              severity: 'success',
            })
          }
          onError={(message) => setSnackbar({ open: true, message, severity: 'error' })}
        />
      </AppStack>

      <AppSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      />
    </>
  )
}
