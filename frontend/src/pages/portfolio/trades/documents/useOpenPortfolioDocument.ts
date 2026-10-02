import { useSelectedPortfolioId } from '@/queries/portfolio'
import { useFetchPortfolioDocumentContent } from '@/queries/portfolioDocument'

/** Quanto tempo a aba tem para ler o arquivo antes de o endereço ser liberado. */
const REVOKE_AFTER_MS = 60_000

/** A mensagem do servidor, que chega dentro de um Blob porque o pedido foi de um arquivo. */
async function errorMessage(error: unknown): Promise<string> {
  const fallback = 'Não foi possível abrir o PDF.'
  const data = (error as { response?: { data?: unknown } })?.response?.data
  if (!(data instanceof Blob)) return fallback
  try {
    const body = JSON.parse(await data.text()) as { message?: string }
    return body.message ?? fallback
  } catch {
    return fallback
  }
}

/** Sem aba (o navegador bloqueou), o arquivo é baixado em vez de aberto. */
function save(url: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = 'documento.pdf'
  link.click()
}

/* Abre um documento guardado numa aba nova.
 *
 * O arquivo vem pela API, com o token, e não há link direto que o navegador
 * possa seguir sozinho. A aba é aberta já no clique, vazia, e recebe o
 * arquivo quando ele chega: aberta depois da espera, ela seria bloqueada como
 * pop-up. */
export function useOpenPortfolioDocument(onError: (message: string) => void) {
  const portfolioId = useSelectedPortfolioId()
  const download = useFetchPortfolioDocumentContent()

  const open = (documentId: number) => {
    if (portfolioId == null) return
    const tab = window.open('', '_blank')
    download.mutate(
      { portfolioId, documentId },
      {
        onSuccess: (blob) => {
          const url = URL.createObjectURL(blob)
          if (tab) tab.location.href = url
          else save(url)
          setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS)
        },
        onError: (error) => {
          tab?.close()
          void errorMessage(error).then(onError)
        },
      }
    )
  }

  return { open, opening: download.isPending }
}
