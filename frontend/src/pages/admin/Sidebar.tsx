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

import { useNavigate } from 'react-router-dom'

export const DRAWER_WIDTH = 240
const FONT_SIZE_LABEL = 16
const FONT_SIZE_HEADER = '1.4rem'

const menuItems = [
  { text: 'Ativos', icon: <TokenIcon fontSize="small" />, path: '/admin/assets' },
  { text: 'Corretoras', icon: <BusinessIcon fontSize="small" />, path: '/admin/brokers' },
  { text: 'Eventos', icon: <EventIcon fontSize="small" />, path: '/admin/events' },
  { text: 'Usuários', icon: <PeopleIcon fontSize="small" />, path: '/admin/users' },
  { text: 'AI Features', icon: <PsychologyIcon fontSize="small" />, path: '/admin/ai-features' },
  { text: 'Design System', icon: <PaletteIcon fontSize="small" />, path: '/admin/design-system' },
]

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
  const pathname = window.location.pathname

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Typography
        variant="subtitle1"
        align="center"
        sx={{ fontWeight: 'bold', fontSize: FONT_SIZE_HEADER, my: 1.05 }}
      >
        Admin Panel
      </Typography>

      <Divider />

      <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
        <List dense>
          {menuItems.map((item) => (
            <ListItemButton
              key={item.text}
              onClick={() => {
                navigate(item.path)
              }}
              selected={pathname === item.path}
            >
              <ListItemIcon sx={{ minWidth: 30 }}>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.text}
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
        },
      }}
    >
      {drawerContent}
    </Drawer>
  )
}
