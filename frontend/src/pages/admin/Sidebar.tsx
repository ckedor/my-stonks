import {
  Box,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material'

import BusinessIcon from '@mui/icons-material/Business'
import EventIcon from '@mui/icons-material/Event'
import PaletteIcon from '@mui/icons-material/Palette'
import PeopleIcon from '@mui/icons-material/People'
import PsychologyIcon from '@mui/icons-material/Psychology'
import TokenIcon from '@mui/icons-material/Token'
import SyncAltIcon from '@mui/icons-material/SyncAlt'

import { alpha, useTheme } from '@mui/material/styles'
import { useLocation, useNavigate } from 'react-router-dom'

import { getAdminNavigationSection } from './navigation'

export const DRAWER_WIDTH = 240
const FONT_SIZE_LABEL = 16
const FONT_SIZE_HEADER = '1.4rem'

const menuIcons: Record<string, React.ReactNode> = {
  '/admin/assets': <TokenIcon fontSize="small" />,
  '/admin/brokers': <BusinessIcon fontSize="small" />,
  '/admin/events': <EventIcon fontSize="small" />,
  '/admin/quote-ingestion': <SyncAltIcon fontSize="small" />,
  '/admin/market-data-series-ingestion': <SyncAltIcon fontSize="small" />,
  '/admin/usd-brl-ingestion': <SyncAltIcon fontSize="small" />,
  '/admin/users': <PeopleIcon fontSize="small" />,
  '/admin/ai-features': <PsychologyIcon fontSize="small" />,
  '/admin/design-system': <PaletteIcon fontSize="small" />,
}

export default function AdminSidebar({
  variant,
  open,
  onClose,
}: {
  variant: 'permanent' | 'persistent'
  open: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const theme = useTheme()
  const section = getAdminNavigationSection(pathname)
  const sidebarText = theme.palette.getContrastText(theme.palette.sidebar)

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Typography
        variant="subtitle1"
        align="center"
        sx={{ fontWeight: 'bold', fontSize: FONT_SIZE_HEADER, mt: 1.05 }}
      >
        Admin Panel
      </Typography>

      <Typography
        variant="caption"
        align="center"
        sx={{ color: alpha(sidebarText, 0.72), mb: 1.05 }}
      >
        {section.label}
      </Typography>

      <Divider sx={{ borderColor: alpha(sidebarText, 0.18) }} />

      <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
        <List dense>
          {section.items.map((item) => (
            <ListItemButton
              key={item.path}
              onClick={() => {
                navigate(item.path)
                onClose()
              }}
              selected={pathname === item.path}
              sx={{
                color: sidebarText,
                '&:hover': {
                  bgcolor: alpha(sidebarText, 0.08),
                },
                '&.Mui-selected': {
                  bgcolor: alpha(sidebarText, 0.16),
                  color: sidebarText,
                  '&:hover': {
                    bgcolor: alpha(sidebarText, 0.22),
                  },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 30, color: 'inherit' }}>
                {menuIcons[item.path]}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontSize: FONT_SIZE_LABEL }}
              />
            </ListItemButton>
          ))}
        </List>
      </Box>
    </Box>
  )

  return (
    <Drawer
      variant={variant}
      open={variant === 'permanent' ? true : open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: DRAWER_WIDTH,
          pt: 1,
          pb: 2,
          bgcolor: 'sidebar',
          color: sidebarText,
          borderColor: alpha(sidebarText, 0.18),
        },
      }}
    >
      {drawerContent}
    </Drawer>
  )
}
