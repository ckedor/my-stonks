import { AppBar, Box, Button, Divider, Toolbar, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import AppIconButton from './AppIconButton'
import { useAppTheme } from './useAppTheme'

/* Qual das duas cores de destaque da barra se lê sobre o fundo dela.
 *
 * `activeText` e `activeBg` são um par: a segunda é o fundo do item ativo, a
 * primeira é o texto por cima dela. A aba selecionada da barra centralizada não
 * pinta fundo nenhum — ela é um sublinhado —, então usar `activeText` ali a
 * desenha direto sobre `background`, e o par não promete nada sobre isso.
 *
 * Os temas se dividem em dois grupos: nos antigos `activeText` é branco e
 * funciona por acaso; nos novos (Pixel Art, Grafite) é escuro, porque foi
 * escolhido para contrastar com um `activeBg` vivo — e a aba selecionada some.
 * Fixar qualquer uma das duas conserta um grupo e quebra o outro, então a
 * escolha é pelo contraste medido. Assim um tema novo já nasce certo, em vez
 * de depender de alguém lembrar da regra. */
function relativeLuminance(color: string): number {
  const hex = color.replace('#', '')
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex
  const channels = [0, 2, 4].map((i) => {
    const value = parseInt(full.slice(i, i + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrastRatio(a: string, b: string): number {
  const [x, y] = [relativeLuminance(a), relativeLuminance(b)]
  const [lighter, darker] = x > y ? [x, y] : [y, x]
  return (lighter + 0.05) / (darker + 0.05)
}

/* Barra superior com abas de seção e uma área de ações.
 *
 * As abas são a navegação de primeiro nível; `children` é o que fica à
 * direita (tema, atalhos, conta). Como na barra lateral, a estrutura mora
 * aqui e a lista de seções vem de fora.
 *
 * `layout` carrega as duas formas que o app tem, e carrega as decisões
 * juntas de propósito — foi assim que elas nasceram, e separá-las em uma
 * prop por detalhe é como se acumulam seis botões de estilo numa barra só:
 *
 *   `full`     — a barra do admin. Fecha com uma régua e marca a seção
 *                ativa com uma pílula.
 *   `centered` — a barra do app. Não fecha com régua (a marca e as abas já
 *                separam) e sublinha a seção ativa.
 *
 * As duas ocupam a largura da janela. A `centered` já acompanhou a faixa
 * central onde o conteúdo mora, e parou quando a coluna de navegação chegou:
 * a coluna encosta na borda esquerda, então a marca precisa cair sobre ela.
 * Uma barra recuada com uma coluna colada na borda é o pior dos dois — nem
 * moldura da janela, nem faixa alinhada.
 *
 * Sem seção na lista, nem as abas nem a régua vertical aparecem: é o que a
 * tela estreita pede, com a navegação migrada para o drawer. */

/** Altura da barra. Exportada porque quem fica logo abaixo dela e também
 *  gruda no topo — a coluna de navegação — precisa saber onde começar, e
 *  duas cópias do número acabariam divergindo. */
export const TOPBAR_HEIGHT = 64

export interface AppTopbarSection {
  id: string
  label: string
}

export interface AppTopbarProps {
  sections: AppTopbarSection[]
  selectedSectionId: string
  onSelectSection: (id: string) => void
  /** Rótulo acessível do grupo de navegação. */
  navLabel: string
  /** Botão à esquerda da marca. Fica a cargo de quem usa dizer o que ele é:
   *  abrir o drawer na tela estreita, recolher a coluna na larga. */
  menuButton?: { label: string; icon: ReactNode; onClick: () => void }
  /** Nome do produto, à esquerda das abas. */
  brand?: { label: string; onClick: () => void }
  /** Padrão: `full`. */
  layout?: 'full' | 'centered'
  /** Ações à direita. */
  children?: ReactNode
}

export default function AppTopbar({
  sections,
  selectedSectionId,
  onSelectSection,
  navLabel,
  menuButton,
  brand,
  layout = 'full',
  children,
}: AppTopbarProps) {
  const centered = layout === 'centered'

  const { topbar } = useAppTheme().palette
  /* A aba selecionada é um sublinhado sem fundo, então a cor tem que se ler
     sobre `background`. Entre as duas de destaque, ganha a que contrasta. */
  const selectedAccent =
    contrastRatio(topbar.activeText, topbar.background) >=
    contrastRatio(topbar.activeBg, topbar.background)
      ? topbar.activeText
      : topbar.activeBg

  return (
    <AppBar
      /* Gruda no topo: as abas de seção são navegação, e navegação que sobe
         junto com o conteúdo deixa de estar lá quando é mais necessária. */
      position="sticky"
      color="transparent"
      elevation={0}
      sx={{
        ...(centered ? null : { borderBottom: 1, borderColor: 'divider' }),
        bgcolor: 'topbar.background',
        color: 'topbar.text',
      }}
    >
      <Toolbar
        sx={{
          justifyContent: 'space-between',
          gap: centered ? 0 : 2,
          ...(centered ? { minHeight: TOPBAR_HEIGHT, height: TOPBAR_HEIGHT } : null),
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: centered ? { xs: 0.5, md: 2 } : 1,
            minWidth: 0,
          }}
        >
          {menuButton && (
            <Box sx={{ color: 'inherit', flexShrink: 0 }}>
              <AppIconButton
                label={menuButton.label}
                onClick={menuButton.onClick}
                tone="inherit"
                edge="start"
                tooltip
              >
                {menuButton.icon}
              </AppIconButton>
            </Box>
          )}

          {brand && (
            <Typography
              variant="h6"
              noWrap
              onClick={brand.onClick}
              sx={{ fontWeight: 'bold', cursor: 'pointer', color: 'topbar.text' }}
            >
              {brand.label}
            </Typography>
          )}

          {brand && sections.length > 0 && (
            <Divider
              orientation="vertical"
              flexItem
              sx={{ mx: 1, borderColor: 'topbar.text', opacity: 0.3 }}
            />
          )}

          {sections.length > 0 && (
            <Box
              component="nav"
              aria-label={navLabel}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: centered ? { xs: 0.5, md: 2 } : 0.5,
                minWidth: 0,
                overflowX: 'auto',
                scrollbarWidth: 'none',
                '&::-webkit-scrollbar': { display: 'none' },
              }}
            >
              {sections.map((section) => {
                const selected = section.id === selectedSectionId

                if (centered) {
                  return (
                    <Button
                      key={section.id}
                      onClick={() => onSelectSection(section.id)}
                      sx={{
                        textTransform: 'none',
                        fontWeight: selected ? 'bold' : 'normal',
                        color: selected ? selectedAccent : 'topbar.text',
                        borderBottom: selected ? 2 : 0,
                        borderColor: selectedAccent,
                        borderRadius: 0,
                        px: 1.5,
                      }}
                    >
                      {section.label}
                    </Button>
                  )
                }

                return (
                  <Typography
                    key={section.id}
                    component="button"
                    type="button"
                    onClick={() => onSelectSection(section.id)}
                    sx={{
                      appearance: 'none',
                      border: 0,
                      borderRadius: 1.5,
                      bgcolor: selected ? 'topbar.activeBg' : 'transparent',
                      color: selected ? 'topbar.activeText' : 'topbar.text',
                      cursor: 'pointer',
                      font: 'inherit',
                      fontSize: '0.875rem',
                      fontWeight: selected ? 700 : 500,
                      lineHeight: 1.5,
                      px: 1.5,
                      py: 0.75,
                      whiteSpace: 'nowrap',
                      '&:hover': {
                        bgcolor: selected ? 'topbar.activeBg' : 'action.hover',
                      },
                      '&:focus-visible': {
                        outline: '2px solid',
                        outlineColor: 'primary.main',
                        outlineOffset: 2,
                      },
                    }}
                  >
                    {section.label}
                  </Typography>
                )
              })}
            </Box>
          )}
        </Box>

        <Box
          sx={{ display: 'flex', gap: centered ? 1 : 2, alignItems: 'center', flexShrink: 0 }}
        >
          {children}
        </Box>
      </Toolbar>
    </AppBar>
  )
}
