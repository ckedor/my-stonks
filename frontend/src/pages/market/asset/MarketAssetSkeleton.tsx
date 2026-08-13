import { Box, Skeleton, Stack } from '@mui/material'

/** Placeholder for the market asset page, laid out to match what loads into it:
 *  breadcrumb, ticker heading, then the quote card with its toolbar and chart. */
export default function MarketAssetSkeleton({ height = 500 }: { height?: number }) {
  return (
    <Box pt={2}>
      {/* Breadcrumbs */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Skeleton variant="text" width={70} height={20} />
        <Skeleton variant="text" width={12} height={20} />
        <Skeleton variant="text" width={60} height={20} />
      </Stack>

      {/* Logo + ticker + type chip */}
      <Box display="flex" alignItems="center" gap={1.25} mb={0.5}>
        <Skeleton variant="rounded" width={28} height={28} />
        <Skeleton variant="text" width={110} height={36} />
        <Skeleton variant="rounded" width={46} height={20} />
      </Box>
      <Skeleton variant="text" width={240} height={24} />

      {/* Header stats: CAGR and the start of the series */}
      <Stack direction="row" spacing={3} sx={{ mt: 1.5, mb: 2 }}>
        <Box>
          <Skeleton variant="text" width={110} height={18} />
          <Skeleton variant="text" width={90} height={26} />
        </Box>
        <Box>
          <Skeleton variant="text" width={110} height={18} />
          <Skeleton variant="text" width={100} height={26} />
        </Box>
      </Stack>

      {/* Quote card */}
      <Box
        sx={{
          p: 2,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Skeleton variant="text" width={90} height={26} sx={{ mb: 1.5 }} />

        {/* Chart toolbar: performance readout on the left, controls on the right */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          rowGap={1}
          sx={{ mb: 1 }}
        >
          <Stack direction="row" spacing={2}>
            <Skeleton variant="text" width={130} height={20} />
            <Skeleton variant="text" width={90} height={20} />
          </Stack>
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" rowGap={1}>
            <Skeleton variant="text" width={54} height={24} />
            <Skeleton variant="text" width={70} height={24} />
            <Skeleton variant="rounded" width={82} height={28} />
            <Skeleton variant="rounded" width={96} height={28} />
            <Skeleton variant="rounded" width={64} height={28} />
            <Skeleton variant="rounded" width={52} height={28} />
            <Skeleton variant="text" width={40} height={24} />
          </Stack>
        </Stack>

        <Skeleton variant="rounded" width="100%" height={height} />
      </Box>
    </Box>
  )
}
