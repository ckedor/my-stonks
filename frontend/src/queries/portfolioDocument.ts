import { fetchPortfolioDocumentContent, fetchPortfolioDocuments } from '@/api/portfolioDocument'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useSelectedPortfolioId } from './portfolio'

const documentKeys = {
  list: (portfolioId: number) => ['portfolio', portfolioId, 'documents'] as const,
}

/** Os PDFs guardados da carteira, do envio mais recente ao mais antigo. */
export function usePortfolioDocuments() {
  const portfolioId = useSelectedPortfolioId()
  return useQuery({
    queryKey: documentKeys.list(portfolioId!),
    queryFn: () => fetchPortfolioDocuments(portfolioId!),
    enabled: portfolioId != null,
  })
}

/** Reler o histórico depois de um envio, que é quando um documento nasce. */
export function useRefreshPortfolioDocuments() {
  const portfolioId = useSelectedPortfolioId()
  const queryClient = useQueryClient()
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: documentKeys.list(portfolioId!) }),
    [queryClient, portfolioId]
  )
}

/* Mutation e não query: o arquivo é baixado quando alguém pede para abrir, e
   não é dado de servidor que valha guardar no cache persistido. */
export function useFetchPortfolioDocumentContent() {
  return useMutation({
    mutationFn: ({ portfolioId, documentId }: { portfolioId: number; documentId: number }) =>
      fetchPortfolioDocumentContent(portfolioId, documentId),
  })
}
