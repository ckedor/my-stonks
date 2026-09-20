import { AppSnackbar, AppStack, PageTitle } from '@/components/ui'
import { useState } from 'react'
import AssetCatalogueSync from '../assets/AssetCatalogueSync'
import CvmRegistrySync from '../assets/CvmRegistrySync'
import FundLinkPanel from '../assets/FundLinkPanel'

/* Sincronização do cadastro de ativos com as fontes de fora.
 *
 * Mora em Integrações e não na tela de Ativos: são chamadas a fontes externas
 * que podem cadastrar o mercado inteiro de uma classe, do mesmo tipo das outras
 * importações — e não parte do cadastro à mão que a tela de Ativos é.
 *
 * Três blocos, e a ordem importa. O provedor cadastra o universo negociável e é
 * quem sabe nome e logo. O regulador corrige o que é fato de registro: quem
 * emitiu o papel, com que CNPJ, em que segmento. O vínculo com o cadastro de
 * fundos fecha a ponte que nenhum arquivo da CVM publica — o código de
 * negociação de um fundo. */

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

        <CvmRegistrySync
          onApplied={(report) =>
            setSnackbar({
              open: true,
              message: `Regulador aplicado: ${report.institutions.created.length} pessoas jurídicas, ${report.assets.updated.length} ações ligadas`,
              severity: 'success',
            })
          }
          onError={(message) => setSnackbar({ open: true, message, severity: 'error' })}
        />

        <FundLinkPanel
          onLinked={(suggestion) =>
            setSnackbar({
              open: true,
              message: `${suggestion.ticker} vinculado ao registro`,
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
