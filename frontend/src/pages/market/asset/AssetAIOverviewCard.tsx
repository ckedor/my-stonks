import { fetchAssetOverviewAndNews, type AssetOverviewAndNews } from '@/api/ai'
import AppCard from '@/components/ui/AppCard'
import MarkdownText from '@/components/ui/MarkdownText'
import RefreshIcon from '@mui/icons-material/Refresh'
import {
    Box,
    CircularProgress,
    IconButton,
    Tooltip,
    Typography,
} from '@mui/material'
import { useCallback, useEffect, useState } from 'react'

interface Props {
  ticker: string
}

export default function AssetAIOverviewCard({ ticker }: Props) {
  const [data, setData] = useState<AssetOverviewAndNews | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (forceGenerate = false) => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetchAssetOverviewAndNews(ticker, forceGenerate)
        setData(response)
      } catch {
        setError('Erro ao carregar análise da IA')
      } finally {
        setLoading(false)
      }
    },
    [ticker],
  )

  useEffect(() => {
    if (ticker) load(false)
  }, [ticker, load])

  return (
    <AppCard>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
        <Typography variant="h6" fontWeight="bold">
            Overview
        </Typography>
        <Tooltip title="Gerar nova análise">
          <span>
            <IconButton size="small" onClick={() => load(true)} disabled={loading}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {loading && !data ? (
        <Box display="flex" justifyContent="center" py={3}>
          <CircularProgress size={24} />
        </Box>
      ) : error ? (
        <Typography color="error" variant="body2">
          {error}
        </Typography>
      ) : data ? (
        <>
          <MarkdownText>{data.payload?.text ?? data.summary}</MarkdownText>
          <Typography variant="caption" color="text.secondary" display="block" mt={1}>
            Gerado em {new Date(data.generated_at).toLocaleString()}
            {data.model ? ` · ${data.model}` : ''}
          </Typography>
        </>
      ) : null}
    </AppCard>
  )
}
