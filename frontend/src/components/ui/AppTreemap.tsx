import { Box } from '@mui/material'
import { Treemap, hierarchy } from '@visx/hierarchy'
import { treemapResquarify } from 'd3-hierarchy'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import AppFloatingCard from './AppFloatingCard'

/* Mapa de área: cada bloco é grande na proporção do quanto vale, e colorido
 * pelo quanto está indo bem.
 *
 * A cor vem de quem chama, como no `AppHeatmapTable`: só quem conhece a
 * escala sabe o que é bom, e o mesmo verde significa coisas diferentes em
 * rentabilidade e em lucro. O que mora aqui é o desenho — o corte das
 * áreas, o rótulo do grupo, o texto claro sobre o bloco saturado e o balão
 * que segue o cursor.
 *
 * O `resquarify` não é detalhe: ele mantém cada bloco no mesmo lugar quando
 * só os valores mudam, e é o que faz trocar a métrica recolorir o mapa em
 * vez de reembaralhá-lo. */

const OUTER_PADDING = 6
const INNER_PADDING = 1
/** Faixa reservada no topo de cada grupo para o nome dele. */
const GROUP_LABEL_BAND = 20
const GROUP_LABEL_FONT_SIZE = 11

/** Altura mínima para um grupo ainda caber nome e bloco.
 *
 *  A faixa do nome é subtraída da caixa do grupo, então um grupo mais baixo do
 *  que ela deixa altura negativa para o que está dentro — e o bloco some. Era
 *  o que acontecia com uma posição de 0,2% da carteira: o grupo saía com 9px,
 *  a faixa pedia 20, e o retângulo do ativo ficava com zero. O que se via era
 *  um grupo vazio, que parece defeito, e não uma fatia pequena.
 *
 *  Abaixo desta altura o nome sai e o bloco fica com a caixa inteira: uma
 *  posição minúscula é uma tira fina de cor, que é o que ela é. */
const MIN_HEIGHT_FOR_GROUP_LABEL = GROUP_LABEL_BAND + 6
const LEAF_FONT_SIZE = 10
/** Claro o bastante para se ler sobre o vermelho e sobre o verde. */
const LEAF_TEXT_COLOR = '#dedede'
const TOOLTIP_WIDTH = 220
const TOOLTIP_OFFSET = 12

export interface AppTreemapLeaf {
  key: string | number
  /** Texto principal dentro do bloco. */
  label: string
  /** Segunda linha dentro do bloco — o valor da métrica, já formatado. */
  caption?: string
  /** Área do bloco. */
  value: number
  /** Cor de fundo do bloco, derivada do dado. */
  tint: string
}

export interface AppTreemapGroup {
  label: string
  items: AppTreemapLeaf[]
}

export interface AppTreemapProps {
  groups: AppTreemapGroup[]
  /** Altura do desenho. Sem ela, o mapa não tem como se dimensionar: a
   *  altura de um treemap não vem do conteúdo. */
  height: number | string
  onSelect?: (key: string | number) => void
  /** Conteúdo do balão que segue o cursor. Sem ela, não há balão. */
  renderTooltip?: (leaf: AppTreemapLeaf) => ReactNode
  /** Cor da moldura entre grupos e do fundo atrás dos blocos. */
  backgroundColor: string
  /** Cor do nome do grupo. */
  labelColor: string
}

export default function AppTreemap({
  groups,
  height,
  onSelect,
  renderTooltip,
  backgroundColor,
  labelColor,
}: AppTreemapProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [hovered, setHovered] = useState<{ leaf: AppTreemapLeaf; x: number; y: number } | null>(null)

  useEffect(() => {
    if (!wrapperRef.current) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height: measured } = entry.contentRect
      setSize({ width, height: measured })
    })
    observer.observe(wrapperRef.current)
    return () => observer.disconnect()
  }, [])

  const root = {
    children: groups.map((group) => ({
      name: group.label,
      children: group.items,
    })),
  }

  return (
    <Box
      ref={wrapperRef}
      sx={{ position: 'relative', width: '100%', height, backgroundColor }}
      onMouseLeave={() => setHovered(null)}
    >
      {size.width > 0 && size.height > 0 && (
        <Treemap
          root={hierarchy<any>(root).sum((node) => node.value)}
          size={[size.width, size.height]}
          tile={treemapResquarify}
          round
          paddingOuter={OUTER_PADDING}
          paddingInner={INNER_PADDING}
          paddingTop={(node) =>
            node.y1 - node.y0 < MIN_HEIGHT_FOR_GROUP_LABEL ? INNER_PADDING : GROUP_LABEL_BAND
          }
        >
          {(treemap) => (
            <>
              {treemap.children?.map((group) => (
                <Box
                  key={`grupo-${group.data.name}`}
                  sx={{
                    position: 'absolute',
                    top: group.y0,
                    left: group.x0,
                    width: group.x1 - group.x0,
                    height: group.y1 - group.y0,
                    border: `1px solid ${backgroundColor}`,
                    boxSizing: 'border-box',
                    pointerEvents: 'none',
                  }}
                >
                  {group.y1 - group.y0 >= MIN_HEIGHT_FOR_GROUP_LABEL && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: OUTER_PADDING,
                        padding: '1px 6px',
                        fontSize: GROUP_LABEL_FONT_SIZE,
                        fontWeight: 'bold',
                        color: labelColor,
                      }}
                    >
                      {group.data.name}
                    </Box>
                  )}
                </Box>
              ))}

              {treemap.leaves().map((node) => {
                const leaf = node.data as AppTreemapLeaf

                return (
                  <Box
                    key={leaf.key}
                    sx={{
                      position: 'absolute',
                      top: node.y0,
                      left: node.x0,
                      width: node.x1 - node.x0,
                      height: node.y1 - node.y0,
                      backgroundColor: leaf.tint,
                      color: LEAF_TEXT_COLOR,
                      fontSize: LEAF_FONT_SIZE,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      padding: '2px',
                      cursor: onSelect ? 'pointer' : 'default',
                      transition: 'background-color 0.3s ease',
                    }}
                    onClick={onSelect ? () => onSelect(leaf.key) : undefined}
                    onMouseMove={(event) => {
                      const bounds = wrapperRef.current?.getBoundingClientRect()
                      if (!bounds) return
                      setHovered({
                        leaf,
                        x: event.clientX - bounds.left,
                        y: event.clientY - bounds.top,
                      })
                    }}
                  >
                    <strong>{leaf.label}</strong>
                    {leaf.caption && <span>{leaf.caption}</span>}
                  </Box>
                )
              })}
            </>
          )}
        </Treemap>
      )}

      {hovered && renderTooltip && (
        <AppFloatingCard
          width={TOOLTIP_WIDTH}
          left={Math.min(hovered.x + TOOLTIP_OFFSET, size.width - TOOLTIP_WIDTH - TOOLTIP_OFFSET)}
          top={hovered.y + TOOLTIP_OFFSET}
        >
          {renderTooltip(hovered.leaf)}
        </AppFloatingCard>
      )}
    </Box>
  )
}
