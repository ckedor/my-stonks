import { PORTFOLIO_DOCUMENT_ROUTES } from '@/constants/routes'
import api from '@/lib/api'

/* Documentos da carteira: os PDFs enviados para ler uma nota ou bater a
 * posição, guardados como chegaram. A leitura guarda; aqui só se lista e se
 * abre. */

export type DocumentKind = 'brokerage_note' | 'position_statement'

/** Uma nota de corretagem confirmada a partir do documento. */
export interface DocumentNote {
  id: number
  broker_name: string
  note_number: string | null
  trade_date: string
}

export interface PortfolioDocument {
  id: number
  kind: DocumentKind
  filename: string
  size_bytes: number
  uploaded_at: string
  notes: DocumentNote[]
}

export const fetchPortfolioDocuments = (portfolioId: number): Promise<PortfolioDocument[]> =>
  api
    .get<PortfolioDocument[]>(PORTFOLIO_DOCUMENT_ROUTES.list, {
      params: { portfolio_id: portfolioId },
    })
    .then((r) => r.data)

/** O arquivo em si. Vem pela API, autenticado, e não por um link direto ao storage. */
export const fetchPortfolioDocumentContent = (
  portfolioId: number,
  documentId: number
): Promise<Blob> =>
  api
    .get<Blob>(PORTFOLIO_DOCUMENT_ROUTES.content(documentId), {
      params: { portfolio_id: portfolioId },
      responseType: 'blob',
    })
    .then((r) => r.data)
