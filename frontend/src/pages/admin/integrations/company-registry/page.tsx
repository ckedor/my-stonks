import { useState } from 'react'

import { AppPageHeader, AppSnackbar, AppStack } from '@/components/ui'

import RoutineScheduleNote from '../RoutineScheduleNote'
import CvmRegistrySync from './CvmRegistrySync'

/* O que o regulador diz de cada ação: a companhia que a emitiu, com CNPJ,
 * bolsa e espécie. Também só aplica depois de mostrar o que mudaria. */

export default function AdminCompanyRegistryPage() {
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    tone: 'success' as 'success' | 'danger',
  })

  return (
    <>
      <AppStack gap="lg">
        <AppPageHeader
          title="Companhias e emissores (CVM)"
          description="Liga cada ação à companhia que a emitiu, com CNPJ, bolsa e espécie. Mostra o que mudaria antes de aplicar."
        />
        <RoutineScheduleNote routineKey="company_registry" />
        <CvmRegistrySync
          onApplied={(report) =>
            setSnackbar({
              open: true,
              message: `Regulador aplicado: ${report.institutions.created.length} pessoas jurídicas, ${report.assets.updated.length} ações ligadas`,
              tone: 'success',
            })
          }
          onError={(message) => setSnackbar({ open: true, message, tone: 'danger' })}
        />
      </AppStack>
      <AppSnackbar
        open={snackbar.open}
        message={snackbar.message}
        tone={snackbar.tone}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      />
    </>
  )
}
