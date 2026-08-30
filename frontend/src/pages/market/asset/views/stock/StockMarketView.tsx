import { fetchStockProfile, type StockProfile } from '@/api/market'
import { AppCard, AppDivider, AppSkeleton, AppStack, AppTabs, AppText } from '@/components/ui'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import AssetQuoteCard from '../../AssetQuoteCard'
import type { AssetMarketViewProps } from '../types'
import StockCompanyCard from './StockCompanyCard'
import StockDecisionCard from './StockDecisionCard'
import StockDividendsCard from './StockDividendsCard'
import StockFundamentalsCard from './StockFundamentalsCard'
import StockStatementCard from './StockStatementCard'
import StockStatisticsCard from './StockStatisticsCard'
import {
  BALANCE_SHEET_GROUPS,
  CASH_FLOW_GROUPS,
  INCOME_STATEMENT_GROUPS,
  statementMetric,
  VALUE_ADDED_GROUPS,
} from './labels'

type SectionId =
  | 'dividends'
  | 'statistics'
  | 'fundamentals'
  | 'income'
  | 'balance'
  | 'cash'
  | 'company'

interface Section {
  id: SectionId
  label: string
  content: ReactNode
}

/** As poucas linhas de cada peça que valem uma série.
 *
 *  Uma DRE tem trinta linhas e um balanço tem sessenta; um seletor com sessenta
 *  opções não é um seletor, é um índice. São as linhas de que se fala quando se
 *  fala da peça — receita e lucro, ativo e patrimônio, caixa das operações.
 */
const INCOME_METRICS = [
  'total_revenue',
  'gross_profit',
  'operating_income',
  'clean_ebitda',
  'net_income',
].map(statementMetric)

const BALANCE_METRICS = [
  'total_assets',
  'total_liab',
  'shareholders_equity',
  'cash',
  'loans_and_financing',
  'long_term_loans_and_financing',
].map(statementMetric)

const CASH_METRICS = [
  'operating_cash_flow',
  'investment_cash_flow',
  'financing_cash_flow',
  'free_cash_flow',
  'final_cash_balance',
].map(statementMetric)

const VALUE_ADDED_METRICS = [
  'added_value_to_distribute',
  'team_remuneration',
  'taxes',
  'own_equity_remuneration',
  'remuneration_of_third_party_capitals',
].map(statementMetric)

/** A tela de mercado de uma ação.
 *
 *  Uma companhia não é um fundo. O que um fundo publica de si é valor de cota e
 *  carteira; o que uma companhia publica é resultado, balanço e caixa — e o
 *  mercado precifica isso num múltiplo. A tela é a do fundo na forma e outra no
 *  conteúdo, pelo mesmo motivo que as duas têm rotas separadas no provedor.
 *
 *  Uma pergunta em cima e o resto atrás de abas. A faixa de decisão responde o
 *  aporte do mês — onde o preço está na faixa do ano, o quanto se paga pelo
 *  lucro e pelo patrimônio, se o negócio é bom e o que ele paga — e é a única
 *  coisa que se lê sem escolher nada. Abaixo dela o gráfico de cotação, e
 *  abaixo dele as seções que a companhia arquiva.
 *
 *  Uma seção sem dado não vira aba. Uma aba "Caixa" vazia numa companhia que o
 *  provedor não cobre faria o leitor procurar o que não existe.
 *
 *  O perfil carrega depois do gráfico, e não com ele: vem de outras rotas do
 *  provedor, e o gráfico não pode esperar por ele nem sumir se ele falhar.
 */
export default function StockMarketView({
  assetId,
  ticker,
  candleData,
  priceFormatter,
}: AssetMarketViewProps) {
  const [profile, setProfile] = useState<StockProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [section, setSection] = useState<SectionId>('dividends')

  useEffect(() => {
    let current = true
    setLoading(true)
    setFailed(false)
    fetchStockProfile(assetId)
      .then((result) => current && setProfile(result))
      .catch(() => current && setFailed(true))
      .finally(() => current && setLoading(false))
    return () => {
      current = false
    }
  }, [assetId])

  const sections = useMemo(() => (profile ? publishedSections(profile) : []), [profile])

  /* A aba escolhida pode não existir na próxima companhia — nem toda uma tem
     DVA arquivada. Sem esta queda para a primeira, a tela abriria sem painel
     nenhum e pareceria quebrada. */
  const current = sections.find((item) => item.id === section) ?? sections[0]

  return (
    <AppStack gap="md">
      {/* A faixa fica acima do gráfico, e a reserva dela também: aparecendo só
          depois da resposta, ela empurraria o gráfico para baixo com a tela já
          lida. */}
      {loading ? <StockDecisionSkeleton /> : profile && <StockDecisionCard profile={profile} />}

      {/* O ticker mudou de nome e quem chegou aqui pode não reconhecer o novo.
          Dizer isso custa uma linha e evita a dúvida de estar na companhia
          errada. */}
      {profile?.renamed && profile.resolved_ticker && (
        <AppText variant="bodySmall" tone="caution">
          {profile.ticker} passou a ser negociada como {profile.resolved_ticker}. Os
          dados abaixo são do código novo.
        </AppText>
      )}

      <AssetQuoteCard
        data={candleData}
        persistKey={`market-asset:${ticker}`}
        priceFormatter={priceFormatter}
      />

      {loading && <StockSectionsSkeleton />}

      {failed && (
        <AppCard>
          <AppText variant="bodySmall" tone="secondary">
            Não foi possível carregar os dados da companhia.
          </AppText>
        </AppCard>
      )}

      {current && (
        <AppStack gap="md">
          <AppStack gap="none">
            <AppDivider />
            <AppTabs
              items={sections.map(({ id, label }) => ({ id, label }))}
              value={current.id}
              onChange={setSection}
              label="Seções da companhia"
            />
          </AppStack>

          {current.content}
        </AppStack>
      )}
    </AppStack>
  )
}

/** As seções que esta companhia tem o que mostrar, na ordem em que se lê uma
 *  empresa: o que ela pagou, o que o mercado paga por ela, como o negócio foi,
 *  as peças que ela arquivou, e quem ela é. */
function publishedSections(profile: StockProfile): Section[] {
  const sections: Section[] = [
    {
      id: 'dividends',
      label: 'Proventos',
      // Renderizado mesmo com as listas vazias: escondê-lo faria uma companhia
      // que nunca pagou parecer uma tela que nunca foi construída, e é o
      // gráfico vazio que diz qual dos dois é.
      content: (
        <StockDividendsCard
          cashDividends={profile.cash_dividends}
          shareDividends={profile.share_dividends}
          subscriptions={profile.subscriptions}
        />
      ),
    },
  ]

  if (profile.statistics) {
    sections.push({
      id: 'statistics',
      label: 'Indicadores',
      content: <StockStatisticsCard statistics={profile.statistics} />,
    })
  }

  if (profile.fundamentals) {
    sections.push({
      id: 'fundamentals',
      label: 'Fundamentos',
      content: <StockFundamentalsCard fundamentals={profile.fundamentals} />,
    })
  }

  if (profile.income_statement.length > 0) {
    sections.push({
      id: 'income',
      label: 'Resultado',
      content: (
        <AppStack gap="md">
          <StockStatementCard
            title="Demonstração do resultado"
            points={profile.income_statement}
            groups={INCOME_STATEMENT_GROUPS}
            metrics={INCOME_METRICS}
          />
          {/* A DVA entra aqui e não numa aba própria: ela reparte o resultado
              entre quem o produziu, e lida longe da DRE vira uma peça sobre
              nada. */}
          {profile.value_added.length > 0 && (
            <StockStatementCard
              title="Valor adicionado"
              points={profile.value_added}
              groups={VALUE_ADDED_GROUPS}
              metrics={VALUE_ADDED_METRICS}
              note="Peça anual: a DVA não é arquivada por trimestre. Valores em reais."
            />
          )}
        </AppStack>
      ),
    })
  }

  if (profile.balance_sheet.length > 0) {
    sections.push({
      id: 'balance',
      label: 'Balanço',
      content: (
        <StockStatementCard
          title="Balanço patrimonial"
          points={profile.balance_sheet}
          groups={BALANCE_SHEET_GROUPS}
          metrics={BALANCE_METRICS}
        />
      ),
    })
  }

  if (profile.cash_flow.length > 0) {
    sections.push({
      id: 'cash',
      label: 'Caixa',
      content: (
        <StockStatementCard
          title="Fluxo de caixa"
          points={profile.cash_flow}
          groups={CASH_FLOW_GROUPS}
          metrics={CASH_METRICS}
        />
      ),
    })
  }

  if (profile.company) {
    sections.push({
      id: 'company',
      label: 'Empresa',
      content: <StockCompanyCard company={profile.company} />,
    })
  }

  return sections
}

/** A reserva da faixa, no lugar exato onde ela vai nascer. */
function StockDecisionSkeleton() {
  return (
    <AppCard>
      <AppStack gap="md">
        <AppSkeleton shape="text" width={140} height={22} />
        <AppStack direction="row" gap="lg" collapseBelow="md">
          <AppSkeleton shape="text" width={240} height={44} />
          <AppSkeleton shape="text" width={130} height={44} />
          <AppSkeleton shape="text" width={130} height={44} />
          <AppSkeleton shape="text" width={140} height={44} />
          <AppSkeleton shape="text" width={175} height={44} />
        </AppStack>
      </AppStack>
    </AppCard>
  )
}

/** A reserva da barra de abas e do painel que ela abre. */
function StockSectionsSkeleton() {
  return (
    <AppStack gap="md">
      <AppStack direction="row" gap="lg">
        <AppSkeleton shape="text" width={96} height={24} />
        <AppSkeleton shape="text" width={104} height={24} />
        <AppSkeleton shape="text" width={112} height={24} />
      </AppStack>
      <AppCard>
        <AppStack gap="sm">
          <AppSkeleton shape="text" width={200} height={28} />
          <AppSkeleton height={280} />
        </AppStack>
      </AppCard>
    </AppStack>
  )
}
