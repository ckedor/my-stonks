import { Box } from '@mui/material'

/* Tabela em que a cor da célula é o dado, e o número só confirma.
 *
 * Não é `AppSimpleTable`: aquela desenha linhas de leitura, com respiro e
 * régua entre elas. Aqui as células precisam se tocar para a mancha de cor
 * ser contínua — é ela que se lê de relance, varrendo a grade atrás dos
 * meses vermelhos.
 *
 * A cor de cada célula vem de quem chama: só quem conhece a escala sabe o
 * que é bom e o que é ruim, e o mesmo verde significa coisas diferentes em
 * rentabilidade e em risco. */

const MIN_WIDTH = 600
const MIN_CELL_WIDTH = 40

export interface AppHeatmapCell {
  /** O que aparece escrito. Vazio vira um traço. */
  text?: string
  background?: string
  color?: string
}

export interface AppHeatmapRow {
  label: string
  cells: AppHeatmapCell[]
}

export interface AppHeatmapTableProps {
  /** Cabeçalho da coluna que identifica a linha. */
  rowHeader: string
  /** Cabeçalhos das colunas de valor, na ordem das células. */
  columns: string[]
  rows: AppHeatmapRow[]
  /** Cor da régua entre as células. */
  borderColor: string
}

export default function AppHeatmapTable({
  rowHeader,
  columns,
  rows,
  borderColor,
}: AppHeatmapTableProps) {
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box
        component="table"
        sx={{ borderCollapse: 'collapse', width: '100%', fontSize: 12, minWidth: MIN_WIDTH }}
      >
        <Box component="thead">
          <Box component="tr">
            <Box component="th" sx={{ textAlign: 'left', padding: '4px 8px' }}>
              {rowHeader}
            </Box>
            {columns.map((column) => (
              <Box key={column} component="th" sx={{ textAlign: 'center', padding: '4px 6px' }}>
                {column}
              </Box>
            ))}
          </Box>
        </Box>

        <Box component="tbody">
          {rows.map((row) => (
            <Box component="tr" key={row.label}>
              <Box
                component="td"
                sx={{ padding: '4px 8px', textAlign: 'left', fontWeight: 500 }}
              >
                {row.label}
              </Box>
              {row.cells.map((cell, index) => (
                <Box
                  component="td"
                  key={columns[index] ?? index}
                  sx={{
                    padding: '2px 4px',
                    textAlign: 'center',
                    border: `1px solid ${borderColor}`,
                    backgroundColor: cell.background,
                    color: cell.color,
                    minWidth: MIN_CELL_WIDTH,
                  }}
                >
                  {cell.text || '-'}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}
