import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart'
import {
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import { TypeBadge, type MarketAsset } from './AssetCard'

/** Denser alternative to the cards: more rows per screen when the user is
 *  scanning a long list rather than browsing. */
export default function AssetListView({
  assets,
  onOpen,
  onBuy,
}: {
  assets: MarketAsset[]
  onOpen: (asset: MarketAsset) => void
  onBuy: (asset: MarketAsset) => void
}) {
  return (
    <Paper variant="outlined">
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Ticker</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Nome</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Tipo</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                Ações
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {assets.map((asset) => (
              <TableRow
                key={asset.id}
                hover
                onClick={() => onOpen(asset)}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {asset.ticker ?? '—'}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {asset.name}
                  </Typography>
                </TableCell>
                <TableCell>
                  {asset.asset_type?.short_name && (
                    <TypeBadge label={asset.asset_type.short_name} />
                  )}
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Registrar compra">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={(event) => {
                        event.stopPropagation()
                        onBuy(asset)
                      }}
                    >
                      <AddShoppingCartIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  )
}
