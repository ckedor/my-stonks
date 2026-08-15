import { Box, Divider, Skeleton, Stack } from '@mui/material'

function MetricSkeleton() {
  return (
    <Box>
      <Skeleton variant="text" width={56} height={14} />
      <Skeleton variant="text" width={84} height={24} />
    </Box>
  )
}

/** Reserva o espaço do que `AssetDetailPanel` desenha: header, abas e o primeiro
 *  card da aba. Se o header mudar de forma, esta reserva muda junto — senão o
 *  conteúdo salta quando os dados chegam. */
export default function AssetDetailPanelSkeleton() {
  return (
    <Box>
      <Box sx={{ pb: 2.5 }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Skeleton variant="text" width={130} height={48} />
          <Skeleton variant="rounded" width={44} height={22} sx={{ borderRadius: 999 }} />
        </Stack>
        <Skeleton variant="text" width={240} height={24} sx={{ mt: 0.5 }} />

        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-end"
          flexWrap="wrap"
          gap={2}
          sx={{ mt: 3 }}
        >
          <Box>
            <Skeleton variant="text" width={60} height={18} />
            <Stack direction="row" spacing={1.25} alignItems="baseline" sx={{ mt: 0.25 }}>
              <Skeleton variant="text" width={150} height={34} />
              <Skeleton variant="text" width={90} height={24} />
            </Stack>
          </Box>
          <Stack direction="row" spacing={1}>
            <Skeleton variant="rounded" width={110} height={32} />
            <Skeleton variant="rounded" width={110} height={32} />
            <Skeleton variant="rounded" width={32} height={32} />
          </Stack>
        </Stack>

        <Stack direction="row" spacing={3} useFlexGap flexWrap="wrap" sx={{ mt: 2.5 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <MetricSkeleton key={i} />
          ))}
        </Stack>
      </Box>

      <Divider />

      <Box sx={{ display: 'flex', gap: 3, alignItems: 'center', minHeight: 40 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="text" width={80} height={24} />
        ))}
      </Box>

      <Box sx={{ py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Skeleton variant="rounded" width="100%" height={410} sx={{ borderRadius: 2 }} />
        <Skeleton variant="rounded" width="100%" height={470} sx={{ borderRadius: 2 }} />
      </Box>
    </Box>
  )
}
