import {
  extractBrokerageNote,
  fetchBrokers,
  importBrokerageNote,
  reconcileBrokerageNote,
  type GroupDecision,
  type NoteHeader,
  type NoteLineInput,
} from '@/api/brokerageNote'
import { useMutation, useQuery } from '@tanstack/react-query'
import { EMPTY_LIST } from './empty'
import { useRefreshPortfolio } from './portfolio'

export function useBrokers() {
  const { data, isPending } = useQuery({ queryKey: ['brokers'], queryFn: fetchBrokers })
  return { brokers: data ?? EMPTY_LIST, loading: isPending }
}

/* Leitura e cruzamento são mutations e não queries: saem de um botão ou de uma
   escolha, custam uma chamada ao modelo (a leitura) e não envelhecem como dado
   de servidor — são a resposta a um pedido. */
export function useExtractBrokerageNote() {
  return useMutation({
    mutationFn: ({ portfolioId, file }: { portfolioId: number; file: File }) =>
      extractBrokerageNote(portfolioId, file),
  })
}

export function useReconcileBrokerageNote() {
  return useMutation({
    mutationFn: ({ portfolioId, lines }: { portfolioId: number; lines: NoteLineInput[] }) =>
      reconcileBrokerageNote(portfolioId, lines),
  })
}

export function useImportBrokerageNote() {
  const refreshPortfolio = useRefreshPortfolio()
  return useMutation({
    mutationFn: ({
      portfolioId,
      note,
      lines,
      decisions,
    }: {
      portfolioId: number
      note: NoteHeader
      lines: NoteLineInput[]
      decisions: GroupDecision[]
    }) => importBrokerageNote(portfolioId, note, lines, decisions),
    onSuccess: () => void refreshPortfolio(),
  })
}
