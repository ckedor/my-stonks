import { logout } from '@/actions/auth'
import { forceRefreshAll } from '@/actions/portfolio'
import CategoryForm from '@/components/CategoryForm'
import DividendForm from '@/components/DividendForm'
import PortfolioForm from '@/components/PortfolioForm'
import { useAuthStore } from '@/stores/auth'
import { useCurrencyStore } from '@/stores/currency'
import { usePortfolioStore } from '@/stores/portfolio'
import { useTradeFormStore } from '@/stores/trade-form'
import { useThemeMode } from '@/theme/theme-mode'

import AccountCircle from '@mui/icons-material/AccountCircle'
import AddIcon from '@mui/icons-material/Add'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import MenuIcon from '@mui/icons-material/Menu'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import CategoryIcon from '@mui/icons-material/Category'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import EditIcon from '@mui/icons-material/Edit'
import LightModeIcon from '@mui/icons-material/LightMode'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import RefreshIcon from '@mui/icons-material/Refresh'
import SettingsIcon from '@mui/icons-material/Settings'

import {
  AppIconButton,
  AppMenu,
  AppMenuButton,
  AppNavDrawer,
  AppSegmentedToggle,
  AppSelect,
  AppSnackbar,
  AppTopbar,
  LoadingSpinner,
  useAppTheme,
  useViewportMatches,
} from '@/components/ui'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  getNavigationSection,
  getSectionDefaultPath,
  isNavigationItemActive,
  navigationSections,
  resolveGroups,
  type SectionId,
} from './navigation'

const CURRENCY_OPTIONS = [
  { value: 'BRL', label: 'R$' },
  { value: 'USD', label: 'US$' },
] as const

export interface MainTopbarProps {
  railCollapsed: boolean
  onToggleRail: () => void
}

export default function MainTopbar({ railCollapsed, onToggleRail }: MainTopbarProps) {
  const user = useAuthStore((s) => s.user)
  const { portfolios, loading, selectedPortfolio, setSelectedPortfolio } = usePortfolioStore()
  const { openTradeForm } = useTradeFormStore()
  const { mode, toggleTheme } = useThemeMode()
  const currency = useCurrencyStore((s) => s.currency)
  const setCurrency = useCurrencyStore((s) => s.setCurrency)
  const navigate = useNavigate()
  const location = useLocation()

  const [selected, setSelected] = useState<number | null>(selectedPortfolio?.id ?? null)
  const [accountAnchor, setAccountAnchor] = useState<null | HTMLElement>(null)
  const [portfolioAnchor, setPortfolioAnchor] = useState<null | HTMLElement>(null)

  const [openForm, setOpenForm] = useState(false)
  const [editMode, setEditMode] = useState(false)

  const theme = useAppTheme()
  const isMobile = useViewportMatches(theme.breakpoints.down('md'))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const currentSection = getNavigationSection(location.pathname)
  const [expandedSections, setExpandedSections] = useState<SectionId[]>(() => [currentSection])

  // Formulários das ações rápidas
  const [openDividendForm, setOpenDividendForm] = useState(false)
  const [openCategoryForm, setOpenCategoryForm] = useState(false)

  const [recalculating, setRecalculating] = useState(false)
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState('')
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success')
  const [actionsAnchor, setActionsAnchor] = useState<null | HTMLElement>(null)

  const handleRecalculate = async () => {
    if (!selectedPortfolio) return
    setRecalculating(true)
    try {
      await forceRefreshAll(selectedPortfolio.id)
      setSnackbarMessage('Posições recalculadas com sucesso.')
      setSnackbarSeverity('success')
      setSnackbarOpen(true)
    } catch (err) {
      console.error(err)
      setSnackbarMessage('Erro ao recalcular posições.')
      setSnackbarSeverity('error')
      setSnackbarOpen(true)
    } finally {
      setRecalculating(false)
    }
  }

  // Sincroniza a carteira selecionada
  useEffect(() => {
    if (selectedPortfolio && selected !== selectedPortfolio.id) {
      setSelected(selectedPortfolio.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPortfolio])

  const handleOpenCreate = () => {
    setEditMode(false)
    setOpenForm(true)
  }
  const handleOpenEdit = () => {
    setEditMode(true)
    setOpenForm(true)
  }

  const selectPortfolio = (id: number) => {
    setSelected(id)
    const portfolio = portfolios.find((p) => p.id === id)
    if (portfolio) setSelectedPortfolio(portfolio)
  }

  return (
    <>
      <AppTopbar
        layout="centered"
        navLabel="Seções do app"
        brand={{ label: 'My Stonks', onClick: () => navigate('/portfolio/overview') }}
        sections={isMobile ? [] : navigationSections.map((s) => ({ id: s.id, label: s.label }))}
        selectedSectionId={currentSection}
        onSelectSection={(id) => {
          const section = navigationSections.find((s) => s.id === id)
          if (section) navigate(getSectionDefaultPath(section))
        }}
        /* O mesmo lugar, à esquerda da marca, para os dois papéis: na tela
           estreita ele abre o drawer; na larga, logo acima da coluna, recolhe
           e expande ela. Nunca os dois ao mesmo tempo — a coluna só existe
           onde o drawer não. */
        menuButton={
          isMobile
            ? {
                label: 'Abrir menu de navegação',
                icon: <MenuIcon />,
                onClick: () => setDrawerOpen(true),
              }
            : {
                label: railCollapsed ? 'Expandir menu' : 'Recolher menu',
                icon: railCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />,
                onClick: onToggleRail,
              }
        }
      >
        {loading ? (
          <LoadingSpinner />
        ) : (
          !isMobile && (
            <AppMenuButton
              open={Boolean(portfolioAnchor)}
              onClick={(event) => setPortfolioAnchor(event.currentTarget)}
            >
              {selectedPortfolio?.name ?? 'Carteira'}
            </AppMenuButton>
          )
        )}

        <AppSegmentedToggle
          label="Moeda"
          options={CURRENCY_OPTIONS}
          value={currency}
          onChange={setCurrency}
        />

        <AppIconButton
          label="Ações rápidas"
          tone="inherit"
          onClick={(event) => setActionsAnchor(event.currentTarget)}
        >
          <MoreVertIcon />
        </AppIconButton>

        <AppIconButton
          label="Conta"
          tone="inherit"
          onClick={(event) => setAccountAnchor(event.currentTarget)}
        >
          <AccountCircle />
        </AppIconButton>
      </AppTopbar>

      <AppMenu
        id="menu-portfolio"
        anchorEl={portfolioAnchor}
        open={Boolean(portfolioAnchor)}
        onClose={() => setPortfolioAnchor(null)}
        minWidth={200}
        options={[
          ...portfolios.map((p) => ({
            label: p.name,
            selected: p.id === selected,
            onSelect: () => {
              selectPortfolio(p.id)
              setPortfolioAnchor(null)
            },
          })),
          {
            label: 'Editar carteira',
            icon: <EditIcon fontSize="small" />,
            tone: 'accent' as const,
            separatorBefore: true,
            onSelect: () => {
              setPortfolioAnchor(null)
              handleOpenEdit()
            },
          },
          {
            label: 'Nova carteira',
            icon: <AddIcon fontSize="small" />,
            tone: 'accent' as const,
            onSelect: () => {
              setPortfolioAnchor(null)
              handleOpenCreate()
            },
          },
        ]}
      />

      <AppMenu
        id="menu-acoes-rapidas"
        anchorEl={actionsAnchor}
        open={Boolean(actionsAnchor)}
        onClose={() => setActionsAnchor(null)}
        options={[
          {
            label: 'Comprar Ativo',
            icon: <AddIcon fontSize="small" />,
            onSelect: () => {
              openTradeForm()
              setActionsAnchor(null)
            },
          },
          {
            label: 'Cadastrar Dividendo',
            icon: <AddIcon fontSize="small" />,
            onSelect: () => {
              setOpenDividendForm(true)
              setActionsAnchor(null)
            },
          },
          {
            label: 'Editar Categorias',
            icon: <CategoryIcon fontSize="small" />,
            onSelect: () => {
              setOpenCategoryForm(true)
              setActionsAnchor(null)
            },
          },
          {
            label: recalculating ? 'Recalculando...' : 'Recalcular Carteira',
            icon: <RefreshIcon fontSize="small" />,
            separatorBefore: true,
            disabled: recalculating,
            onSelect: handleRecalculate,
          },
        ]}
      />

      <AppMenu
        id="menu-conta"
        anchorEl={accountAnchor}
        open={Boolean(accountAnchor)}
        onClose={() => setAccountAnchor(null)}
        options={[
          { label: user?.email ?? '', disabled: true },
          {
            label: 'Configurações',
            icon: <SettingsIcon fontSize="small" />,
            separatorBefore: true,
            onSelect: () => {
              navigate('/portfolio/user-configurations')
              setAccountAnchor(null)
            },
          },
          {
            label: mode === 'dark' ? 'Modo Claro' : 'Modo Escuro',
            icon:
              mode === 'dark' ? (
                <LightModeIcon fontSize="small" />
              ) : (
                <DarkModeIcon fontSize="small" />
              ),
            iconTone: 'golden' as const,
            onSelect: () => {
              toggleTheme()
              setAccountAnchor(null)
            },
          },
          ...(user?.is_admin
            ? [
                {
                  label: 'Admin',
                  icon: <AdminPanelSettingsIcon fontSize="small" />,
                  onSelect: () => {
                    navigate('/admin')
                    setAccountAnchor(null)
                  },
                },
              ]
            : []),
          {
            label: 'Logout',
            onSelect: () => {
              logout()
              navigate('/login')
            },
          },
        ]}
      />

      <AppNavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="My Stonks"
        header={
          <AppSelect
            size="full"
            options={portfolios.map((p) => ({ value: String(p.id), label: p.name }))}
            value={selected === null ? '' : String(selected)}
            onChange={(value) => selectPortfolio(Number(value))}
            actions={[
              {
                label: 'Editar Carteira',
                icon: <EditIcon fontSize="small" />,
                onSelect: handleOpenEdit,
              },
              {
                label: 'Nova Carteira',
                icon: <AddIcon fontSize="small" />,
                onSelect: handleOpenCreate,
              },
            ]}
          />
        }
        sections={navigationSections.map((section) => ({
          id: section.id,
          label: section.label,
          active: section.id === currentSection,
          groups: resolveGroups(section, {
            categories: (selectedPortfolio?.custom_categories ?? []).map((category) => ({
              label: category.name,
              path: `/portfolio/category/${category.id}`,
            })),
          }).map((group) => ({
            title: group.title,
            items: group.items.map((item) => ({
              id: item.path,
              label: item.label,
              active: isNavigationItemActive(location.pathname, item.path),
            })),
          })),
        }))}
        openSectionIds={expandedSections}
        onToggleSection={(id) =>
          setExpandedSections((prev) =>
            prev.includes(id as SectionId)
              ? prev.filter((s) => s !== id)
              : [...prev, id as SectionId],
          )
        }
        onSelect={(path) => navigate(path)}
      />

      <PortfolioForm
        open={openForm}
        onClose={() => setOpenForm(false)}
        portfolio={editMode ? selectedPortfolio ?? undefined : undefined}
      />

      <DividendForm open={openDividendForm} onClose={() => setOpenDividendForm(false)} />
      <CategoryForm open={openCategoryForm} onClose={() => setOpenCategoryForm(false)} />

      <AppSnackbar
        open={snackbarOpen}
        message={snackbarMessage}
        severity={snackbarSeverity}
        onClose={() => setSnackbarOpen(false)}
      />
    </>
  )
}
