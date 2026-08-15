import { useThemeMode } from '@/theme/theme-mode'; // seu hook do ThemeRegistry
import { DarkMode, LightMode } from '@mui/icons-material';
import { IconButton, Tooltip, useTheme } from '@mui/material';

export function ThemeToggleButton() {
  const { mode, toggleTheme } = useThemeMode()
  const theme = useTheme()

  const icon =
    mode === 'dark'
    ? <DarkMode  sx={{ color: theme.palette.golden }} />   
    : <LightMode sx={{ color: theme.palette.golden }} />    
  return (
    <Tooltip title={mode === 'dark' ? 'Modo claro' : 'Modo escuro'}>
      <IconButton
        onClick={toggleTheme}
        color="inherit"
        aria-label="alternar tema"
        sx={{ ml: 1, color: 'topbar.text' }}
      >
        {icon}
      </IconButton>
    </Tooltip>
  )
}
