import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart'
import { alpha, Box, IconButton, Tooltip, Typography } from '@mui/material'

export interface MarketAsset {
  id: number
  ticker: string | null
  name: string
  asset_type_id: number
  asset_type?: { id: number; short_name: string; name: string; asset_class_id?: number }
}

/** Muted, readable badge. Colouring every type competes with the ticker for
 *  attention, so the type reads as a label rather than a status. */
export function TypeBadge({ label }: { label: string }) {
  return (
    <Typography
      component="span"
      sx={{
        color: 'text.secondary',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        bgcolor: 'action.hover',
        borderRadius: 1,
        px: 0.75,
        py: 0.25,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Typography>
  )
}

export default function AssetCard({
  asset,
  onOpen,
  onBuy,
}: {
  asset: MarketAsset
  onOpen: () => void
  onBuy: () => void
}) {
  return (
    <Box
      onClick={onOpen}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        p: 2,
        cursor: 'pointer',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        transition: 'border-color 150ms, transform 150ms, box-shadow 150ms',
        '&:hover': {
          borderColor: 'primary.main',
          transform: 'translateY(-2px)',
          boxShadow: (theme) => `0 6px 20px ${alpha(theme.palette.common.black, 0.08)}`,
        },
        // The buy button only asserts itself once the card is engaged with.
        '&:hover .asset-card-action': { opacity: 1 },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: 16,
            letterSpacing: '-0.01em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {asset.ticker ?? asset.name}
        </Typography>
        {asset.asset_type?.short_name && <TypeBadge label={asset.asset_type.short_name} />}
      </Box>

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          flexGrow: 1,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {asset.name}
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
        <Tooltip title="Registrar compra">
          <IconButton
            className="asset-card-action"
            size="small"
            onClick={(event) => {
              event.stopPropagation()
              onBuy()
            }}
            sx={{ opacity: 0, transition: 'opacity 150ms', color: 'primary.main' }}
          >
            <AddShoppingCartIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  )
}
