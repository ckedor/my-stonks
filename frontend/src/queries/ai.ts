import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import {
  fetchAiFeatures,
  fetchAiPromptVersions,
  fetchAiRuns,
  fetchAiUsage,
} from '@/api/ai'
import { EMPTY_LIST } from '@/queries/empty'

/* As chaves da IA. */
const aiKeys = {
  all: ['ai'] as const,
  features: () => [...aiKeys.all, 'features'] as const,
  promptVersions: (key: string) => [...aiKeys.all, 'prompt-versions', key] as const,
  usage: (days: number) => [...aiKeys.all, 'usage', days] as const,
  runs: (limit: number) => [...aiKeys.all, 'runs', limit] as const,
}

export function useAiFeatures() {
  const { data, isPending } = useQuery({ queryKey: aiKeys.features(), queryFn: fetchAiFeatures })
  return { features: data ?? EMPTY_LIST, loading: isPending && !data }
}

export function useAiPromptVersions(featureKey: string | undefined) {
  const { data, isPending } = useQuery({
    queryKey: aiKeys.promptVersions(featureKey ?? ''),
    queryFn: () => fetchAiPromptVersions(featureKey as string),
    enabled: Boolean(featureKey),
  })
  return { versions: data ?? EMPTY_LIST, loading: isPending && !data }
}

export function useAiUsage(days = 30) {
  const { data, isPending } = useQuery({
    queryKey: aiKeys.usage(days),
    queryFn: () => fetchAiUsage(days),
  })
  return { usage: data ?? EMPTY_LIST, loading: isPending && !data }
}

export function useAiRuns(limit = 100) {
  const { data, isPending } = useQuery({
    queryKey: aiKeys.runs(limit),
    queryFn: () => fetchAiRuns(limit),
  })
  return { runs: data ?? EMPTY_LIST, loading: isPending && !data }
}

/** Invalida tudo de IA depois de uma escrita — ativar prompt, editar feature. */
export function useRefreshAi() {
  const queryClient = useQueryClient()
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: aiKeys.all })
  }, [queryClient])
}
