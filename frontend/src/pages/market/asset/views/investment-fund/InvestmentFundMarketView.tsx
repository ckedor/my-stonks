import { fetchInvestmentFundProfile, type InvestmentFundProfile } from '@/api/market'
import { AppCard, AppDivider, AppSkeleton, AppStack, AppTabs, AppText } from '@/components/ui'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import AssetQuoteCard from '../../AssetQuoteCard'
import type { AssetMarketViewProps } from '../types'
import FundDecisionCard from './FundDecisionCard'
import FundDividendsCard from './FundDividendsCard'
import FundIdentityCard from './FundIdentityCard'
import FundIndicatorsCard from './FundIndicatorsCard'
import FundNavHistoryCard from './FundNavHistoryCard'
import FundPortfolioCard from './FundPortfolioCard'
import FundRegulatoryProfileCard from './FundRegulatoryProfileCard'

type SectionId = 'dividends' | 'nav' | 'indicators' | 'portfolio' | 'profile' | 'fund'

interface Section {
  id: SectionId
  label: string
  content: ReactNode
}

/** A tela de mercado de um fundo de investimento que não é imobiliário.
 *
 *  Um FIAGRO, um FI-Infra, um FIDC, um FIP e um FIF não têm prédio nem vacância:
 *  o que eles publicam é valor de cota, patrimônio, cotistas, o crédito que
 *  carregam e — para os que o regulador exige — quem os detém e quanto risco
 *  declaram. A tela é a do FII na forma e outra no conteúdo, pelo mesmo motivo
 *  que os dois têm rotas separadas no provedor.
 *
 *  Uma pergunta em cima e o resto atrás de abas. A faixa de decisão responde o
 *  aporte do mês — preço contra valor patrimonial, se o rendimento se sustenta,
 *  para onde o valor da cota andou, e o tamanho do fundo — e é a única coisa que
 *  se lê sem escolher nada. Abaixo dela o gráfico de cotação, e abaixo dele as
 *  seções que o fundo publica.
 *
 *  Uma seção sem dado não vira aba. Uma aba "Perfil mensal" vazia num FIP, que
 *  não entrega esse informe, faria o leitor procurar o que não existe.
 *
 *  O perfil carrega depois do gráfico, e não com ele: vem de outras rotas do
 *  provedor, e o gráfico não pode esperar por ele nem sumir se ele falhar.
 */
export default function InvestmentFundMarketView({
  assetId,
  ticker,
  candleData,
  priceFormatter,
}: AssetMarketViewProps) {
  const [profile, setProfile] = useState<InvestmentFundProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [section, setSection] = useState<SectionId>('dividends')

  useEffect(() => {
    let current = true
    setLoading(true)
    setFailed(false)
    fetchInvestmentFundProfile(assetId)
      .then((result) => current && setProfile(result))
      .catch(() => current && setFailed(true))
      .finally(() => current && setLoading(false))
    return () => {
      current = false
    }
  }, [assetId])

  const sections = useMemo(() => (profile ? publishedSections(profile) : []), [profile])

  /* A aba escolhida pode não existir no próximo fundo — um FIP não tem "Perfil
     mensal". Sem esta queda para a primeira, a tela abriria sem painel nenhum e
     pareceria quebrada. */
  const current = sections.find((item) => item.id === section) ?? sections[0]

  return (
    <AppStack gap="md">
      {/* A faixa fica acima do gráfico, e a reserva dela também: aparecendo só
          depois da resposta, ela empurraria o gráfico para baixo com a tela já
          lida. */}
      {loading ? <FundDecisionSkeleton /> : profile && <FundDecisionCard profile={profile} />}

      <AssetQuoteCard
        data={candleData}
        persistKey={`market-asset:${ticker}`}
        priceFormatter={priceFormatter}
      />

      {loading && <FundSectionsSkeleton />}

      {failed && (
        <AppCard>
          <AppText variant="bodySmall" tone="secondary">
            Não foi possível carregar os dados do fundo.
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
              label="Seções do fundo"
            />
          </AppStack>

          {current.content}
        </AppStack>
      )}
    </AppStack>
  )
}

/** As seções que este fundo tem o que mostrar, na ordem em que se lê um fundo:
 *  o que ele pagou, o que a cota dele vale, os números dele, o que ele tem, quem
 *  o detém e o cadastro. */
function publishedSections(profile: InvestmentFundProfile): Section[] {
  const sections: Section[] = [
    {
      id: 'dividends',
      label: 'Rendimentos',
      // Renderizado mesmo com a lista vazia: escondê-lo faria um provedor que
      // não respondeu nada parecer uma tela que nunca foi construída, e é o
      // gráfico que diz qual dos dois é.
      content: <FundDividendsCard dividends={profile.dividends} />,
    },
  ]

  if (profile.nav_history.length > 0) {
    sections.push({
      id: 'nav',
      label: 'Valor da cota',
      content: <FundNavHistoryCard history={profile.nav_history} />,
    })
  }

  if (profile.indicators) {
    sections.push({
      id: 'indicators',
      label: 'Indicadores',
      content: <FundIndicatorsCard indicators={profile.indicators} />,
    })
  }

  if (profile.portfolio) {
    sections.push({
      id: 'portfolio',
      label: 'Carteira',
      content: <FundPortfolioCard portfolio={profile.portfolio} />,
    })
  }

  if (profile.regulatory_profile) {
    sections.push({
      id: 'profile',
      label: 'Perfil mensal',
      content: <FundRegulatoryProfileCard profile={profile.regulatory_profile} />,
    })
  }

  if (profile.identity || profile.indicators) {
    sections.push({
      id: 'fund',
      label: 'Fundo',
      content: (
        <FundIdentityCard
          identity={profile.identity}
          indicators={profile.indicators}
          portfolioDate={profile.portfolio?.reference_date ?? null}
        />
      ),
    })
  }

  return sections
}

/** A reserva da faixa, no lugar exato onde ela vai nascer. */
function FundDecisionSkeleton() {
  return (
    <AppCard>
      <AppStack gap="md">
        <AppSkeleton shape="text" width={90} height={22} />
        <AppStack direction="row" gap="lg" collapseBelow="md">
          <AppSkeleton shape="text" width={240} height={44} />
          <AppSkeleton shape="text" width={150} height={44} />
          <AppSkeleton shape="text" width={140} height={44} />
          <AppSkeleton shape="text" width={160} height={44} />
          <AppSkeleton shape="text" width={130} height={44} />
        </AppStack>
      </AppStack>
    </AppCard>
  )
}

/** A reserva da barra de abas e do painel que ela abre. */
function FundSectionsSkeleton() {
  return (
    <AppStack gap="md">
      <AppStack direction="row" gap="lg">
        <AppSkeleton shape="text" width={96} height={24} />
        <AppSkeleton shape="text" width={104} height={24} />
        <AppSkeleton shape="text" width={88} height={24} />
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
