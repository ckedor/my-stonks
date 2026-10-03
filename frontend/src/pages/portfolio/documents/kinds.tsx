import type { DocumentKind } from '@/api/portfolioDocument'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined'
import type { ReactNode } from 'react'

/* Os tipos de documento da carteira: o nome, o ícone e por onde cada um
 * entra. Um tipo novo em `DocumentKind` não compila sem chegar aqui — é o que
 * o põe na tela com nome e card próprios, e não como chave crua. */

export interface DocumentKindInfo {
  one: string
  many: string
  icon: ReactNode
  /** Onde, no app, um arquivo deste tipo é enviado. */
  source: string
}

export const DOCUMENT_KIND: Record<DocumentKind, DocumentKindInfo> = {
  brokerage_note: {
    one: 'Nota de corretagem',
    many: 'Notas de corretagem',
    icon: <ReceiptLongOutlinedIcon fontSize="small" />,
    source: 'Trades › Importar nota',
  },
  position_statement: {
    one: 'Extrato de posição',
    many: 'Extratos de posição',
    icon: <AccountBalanceWalletOutlinedIcon fontSize="small" />,
    source: 'Trades › Bater posição',
  },
}

export const DOCUMENT_KINDS = Object.keys(DOCUMENT_KIND) as DocumentKind[]
