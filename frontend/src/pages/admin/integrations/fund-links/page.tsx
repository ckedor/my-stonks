import { useState } from 'react'

import { AppPageHeader, AppSnackbar, AppStack } from '@/components/ui'

import RoutineScheduleNote from '../RoutineScheduleNote'
import FundLinkPanel from './FundLinkPanel'

/* A ponte que nenhum arquivo da CVM publica: o código de negociação de um
 * fundo. O provedor sugere o CNPJ de cada FII e alguém confirma; um ETF
 * brasileiro é buscado no cadastro de fundos à mão. */

export default function AdminFundLinksPage() {
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    tone: 'success' as 'success' | 'danger',
  })

  return (
    <>
      <AppStack gap="lg">
        <AppPageHeader
          title="Vínculo de FIIs e ETFs brasileiros"
          description="Liga cada FII e ETF brasileiro ao fundo que o regulador registrou."
        />
        <RoutineScheduleNote routineKey="fund_links" />
        <FundLinkPanel
          onLinked={(suggestion) =>
            setSnackbar({
              open: true,
              message: `${suggestion.ticker} vinculado ao registro`,
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
