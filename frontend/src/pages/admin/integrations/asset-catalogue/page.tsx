import { useState } from 'react'

import { AppPageHeader, AppSnackbar, AppStack } from '@/components/ui'

import RoutineScheduleNote from '../RoutineScheduleNote'
import AssetCatalogueSync from './AssetCatalogueSync'

/* O catálogo do provedor contra o cadastro de ativos. Ele cadastra o universo
 * negociável e corrige nome e logo; como reescreve o que as telas mostram,
 * só aplica depois que alguém leu o que mudaria. */

export default function AdminAssetCataloguePage() {
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  })

  return (
    <>
      <AppStack gap="lg">
        <AppPageHeader
          title="Catálogo de ativos"
          description="Cadastra o universo negociável do provedor e corrige nomes e logos. Mostra o que mudaria antes de aplicar."
        />
        <RoutineScheduleNote routineKey="asset_catalogue" />
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
