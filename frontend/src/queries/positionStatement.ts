import {
  comparePositions,
  extractPositionStatement,
  type StatementHolding,
} from '@/api/positionStatement'
import { useMutation } from '@tanstack/react-query'

/* Mutations e não queries: saem de um botão ou de uma correção, a leitura custa
   uma chamada ao modelo, e o diagnóstico é a resposta a um pedido — não dado
   de servidor que envelhece. */
export function useExtractPositionStatement() {
  return useMutation({
    mutationFn: ({ portfolioId, file }: { portfolioId: number; file: File }) =>
      extractPositionStatement(portfolioId, file),
  })
}

export function useComparePositions() {
  return useMutation({
    mutationFn: ({
      portfolioId,
      brokerId,
      asOf,
      holdings,
    }: {
      portfolioId: number
      brokerId: number
      asOf: string
      holdings: StatementHolding[]
    }) => comparePositions(portfolioId, brokerId, asOf, holdings),
  })
}
