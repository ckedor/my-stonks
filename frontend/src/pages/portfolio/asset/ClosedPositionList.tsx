import {
  AppSimpleTable,
  AppStack,
  AppText,
  type AppSimpleTableColumn,
} from '@/components/ui'
import { useCurrency } from '@/hooks/useCurrency'
import type { ClosedPositionEntry } from '@/types'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { CategoryAssignmentPrompt, CategoryCell } from './CategoryAssignment'
import { useCategoryAssignment } from './category-assignment'

/* O que a carteira teve e não tem mais.
 *
 * Uma tabela só, sem agrupamento: uma posição encerrada não pesa na carteira,
 * então agrupar por categoria e somar o grupo responderia uma pergunta que
 * não existe. A ordem é a da saída, da mais recente para a mais antiga — é
 * assim que a pessoa procura o que vendeu.
 *
 * As duas leituras aparecem lado a lado de propósito. O lucro realizado diz
 * quanto dinheiro a ida e volta fez; a rentabilidade acumulada diz como o
 * ativo se comportou enquanto esteve na carteira, proventos incluídos. Uma
 * posição grande e curta bate uma pequena e longa no primeiro número e perde
 * no segundo, e é por isso que nenhum dos dois sozinho responde "como eu
 * performei". */

interface ClosedPositionListProps {
  positions: ClosedPositionEntry[]
  /** A busca é do cabeçalho da página, que é quem a guarda. */
  search: string
}

const formatPercent = (value: number) =>
  `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`

const formatDate = (value: string) => dayjs(value).format('DD/MM/YYYY')

/** Quanto tempo a posição durou, na unidade que se lê sem contar nos dedos. */
const formatHolding = (days: number) => {
  if (days < 30) return `${days} d`
  if (days < 365) return `${Math.round(days / 30)} m`
  return `${(days / 365.25).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} a`
}

export default function ClosedPositionList({ positions, search }: ClosedPositionListProps) {
  const navigate = useNavigate()
  const { format: formatCurrency } = useCurrency()
  const assignment = useCategoryAssignment()

  const term = search.toLowerCase()
  const filtered = positions.filter(
    (pos) =>
      term === '' ||
      (pos.ticker?.toLowerCase().includes(term) ?? false) ||
      pos.name.toLowerCase().includes(term),
  )

  /** Três degraus pelo sinal, como o resto da tela lê um retorno. */
  const signTone = (value: number | null | undefined) =>
    value == null || value === 0 ? 'default' : value > 0 ? 'success' : 'danger'

  const columns: AppSimpleTableColumn<ClosedPositionEntry>[] = [
    {
      label: 'Ativo',
      width: 'clamped',
      render: (pos) => (
        <AppStack>
          <AppText variant="bodySmall" weight="strong" noWrap>
            {pos.name || pos.ticker}
          </AppText>
          <AppText variant="caption" tone="secondary" noWrap>
            {[pos.ticker, pos.type].filter(Boolean).join(' · ')}
          </AppText>
        </AppStack>
      ),
    },
    {
      label: 'Período',
      render: (pos) => (
        <AppStack>
          <AppText variant="bodySmall" noWrap>
            {formatDate(pos.entry_date)} → {formatDate(pos.exit_date)}
          </AppText>
          <AppText variant="caption" tone="secondary">
            {formatHolding(pos.days_held)}
          </AppText>
        </AppStack>
      ),
    },
    {
      label: 'Quantidade',
      align: 'right',
      render: (pos) => (
        <AppText variant="bodySmall">
          {pos.quantity_sold.toLocaleString('pt-BR', { maximumFractionDigits: 8 })}
        </AppText>
      ),
    },
    {
      label: 'Preço Médio',
      align: 'right',
      render: (pos) => (
        <AppStack align="end">
          <AppText variant="bodySmall">{formatCurrency(pos.average_price)}</AppText>
          <AppText variant="caption" tone="secondary">
            venda {formatCurrency(pos.average_sale_price)}
          </AppText>
        </AppStack>
      ),
    },
    {
      label: 'Vendido',
      align: 'right',
      render: (pos) => (
        <AppText variant="bodySmall">{formatCurrency(pos.gross_sales)}</AppText>
      ),
    },
    {
      label: 'Lucro Realizado',
      align: 'right',
      render: (pos) => (
        <AppStack align="end">
          <AppText variant="bodySmall" weight="strong" tone={signTone(pos.realized_profit)}>
            {formatCurrency(pos.realized_profit)}
          </AppText>
          {pos.realized_profit_pct != null && (
            <AppText variant="caption" tone={signTone(pos.realized_profit_pct)}>
              {pos.realized_profit_pct > 0 ? '+' : ''}
              {formatPercent(pos.realized_profit_pct)}
            </AppText>
          )}
        </AppStack>
      ),
    },
    {
      label: 'Proventos',
      align: 'right',
      render: (pos) => (
        <AppText variant="bodySmall" tone="secondary">
          {pos.dividends > 0 ? formatCurrency(pos.dividends) : '—'}
        </AppText>
      ),
    },
    {
      label: 'Rent. Acumulada',
      align: 'right',
      render: (pos) => (
        <AppStack align="end">
          <AppText variant="bodySmall" weight="strong" tone={signTone(pos.acc_return)}>
            {pos.acc_return != null ? formatPercent(pos.acc_return * 100) : '—'}
          </AppText>
          {pos.cagr != null && (
            <AppText variant="caption" tone={signTone(pos.cagr)}>
              CAGR {formatPercent(pos.cagr * 100)}
            </AppText>
          )}
        </AppStack>
      ),
    },
    {
      label: 'Categoria',
      render: (pos) => (
        <CategoryCell assignment={assignment} assetId={pos.asset_id} categoryName={pos.category} />
      ),
    },
  ]

  if (filtered.length === 0) {
    return (
      <AppText tone="secondary">
        Nenhum ativo encerrado. Aqui aparece o que você teve na carteira e vendeu por completo.
      </AppText>
    )
  }

  return (
    <AppStack gap="lg">
      <AppSimpleTable
        rows={filtered}
        columns={columns}
        getRowKey={(pos) => pos.asset_id}
        onRowClick={(pos) => navigate(`/portfolio/asset/${pos.asset_id}`)}
      />

      <CategoryAssignmentPrompt assignment={assignment} />
    </AppStack>
  )
}
