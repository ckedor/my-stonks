import {
  deleteDarfPayment,
  fetchAssetsAndRights,
  fetchIncomeTaxAssessment,
  registerDarfPayment,
  type DarfPaymentInput,
} from '@/api/incomeTax'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

/* As chaves ficam sob `['portfolio']` de propósito: a apuração é derivada das
   transações, e toda escrita na carteira invalida esse prefixo
   (`useRefreshPortfolio`). Uma negociação nova reapura o imposto sem ninguém
   lembrar de pedir. */
const incomeTaxKeys = {
  all: ['portfolio', 'income-tax'] as const,
  assessment: (fiscalYear: number) => [...incomeTaxKeys.all, 'assessment', fiscalYear] as const,
  assetsAndRights: (portfolioId: number, fiscalYear: number) =>
    [...incomeTaxKeys.all, 'assets-and-rights', portfolioId, fiscalYear] as const,
}

export function useIncomeTaxAssessment(fiscalYear: number) {
  return useQuery({
    queryKey: incomeTaxKeys.assessment(fiscalYear),
    queryFn: () => fetchIncomeTaxAssessment(fiscalYear),
    /* Cada venda do ano vem na resposta: guardá-la no localStorage tomaria a
       cota que a carteira usa para abrir quente. */
    meta: { persist: false },
  })
}

export function useAssetsAndRights(portfolioId: number, fiscalYear: number) {
  return useQuery({
    queryKey: incomeTaxKeys.assetsAndRights(portfolioId, fiscalYear),
    queryFn: () => fetchAssetsAndRights(portfolioId, fiscalYear),
  })
}

function useInvalidateAssessment() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: [...incomeTaxKeys.all, 'assessment'] })
}

export function useRegisterDarfPayment() {
  const invalidate = useInvalidateAssessment()
  return useMutation({
    mutationFn: (payment: DarfPaymentInput) => registerDarfPayment(payment),
    onSuccess: () => void invalidate(),
  })
}

export function useDeleteDarfPayment() {
  const invalidate = useInvalidateAssessment()
  return useMutation({
    mutationFn: (paymentId: number) => deleteDarfPayment(paymentId),
    onSuccess: () => void invalidate(),
  })
}
