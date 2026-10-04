import { useCallback, useEffect, useState } from 'react'
import { DEPLOY_ENDPOINT, type DeployMode, type DeployOverview } from './contract'

/** O estado do repositório e da execução, lido do dev server. Enquanto algo
 *  roda, a cada segundo; parado, ao voltar para a aba. */
export function useDeploy() {
  const [overview, setOverview] = useState<DeployOverview | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${DEPLOY_ENDPOINT}/`)
      if (!response.ok) throw new Error((await response.json()).message)
      setOverview(await response.json())
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }
  }, [])

  const running = overview?.run?.status === 'running'

  useEffect(() => {
    void refresh()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [refresh])

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(refresh, 1000)
    return () => window.clearInterval(timer)
  }, [running, refresh])

  const start = async (mode: DeployMode, message: string) => {
    const response = await fetch(`${DEPLOY_ENDPOINT}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, message }),
    })
    if (!response.ok) setError((await response.json()).message)
    await refresh()
  }

  return { overview, error, running, start }
}
