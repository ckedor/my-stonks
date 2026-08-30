import { fetchFIIProfile, type FIIProfile } from '@/api/market'
import { AppCard, AppDivider, AppSkeleton, AppStack, AppTabs, AppText } from '@/components/ui'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import AssetQuoteCard from '../../AssetQuoteCard'
import type { AssetMarketViewProps } from '../types'
import FIICompositionCard from './FIICompositionCard'
import FIIDecisionCard from './FIIDecisionCard'
import FIIDividendsCard from './FIIDividendsCard'
import FIIFundCard from './FIIFundCard'
import FIIIndicatorsCard from './FIIIndicatorsCard'
import FIIIndicatorsHistoryCard from './FIIIndicatorsHistoryCard'
import FIIMonthlyReportCard from './FIIMonthlyReportCard'
import FIIPropertiesCard from './FIIPropertiesCard'

type SectionId = 'dividends' | 'indicators' | 'properties' | 'composition' | 'report' | 'fund'

interface Section {
  id: SectionId
  label: string
  content: ReactNode
}

/** A tela de mercado de um fundo imobiliário.
 *
 *  Uma pergunta em cima e o resto atrás de abas. A faixa de decisão responde
 *  o aporte do mês — preço contra valor patrimonial, se o rendimento se
 *  sustenta, para onde foi a vacância — e é a única coisa que se lê sem
 *  escolher nada. Abaixo dela o gráfico de cotação, e abaixo dele as seis
 *  seções que o fundo publica.
 *
 *  Elas eram sete cards empilhados: sete títulos, vinte e cinco métricas de
 *  mesmo peso e seis tabelas em uma coluna só. Nada saiu da tela — as abas
 *  guardam todas elas inteiras, e é a faixa que decide o que se lê primeiro.
 *
 *  Uma seção sem dado não vira aba. Uma aba "Imóveis" vazia num fundo de papel
 *  faria o leitor procurar o que não existe, e é a faixa que diz por quê.
 *
 *  O perfil carrega depois do gráfico, e não com ele: vem de outras rotas do
 *  provedor, e o gráfico não pode esperar por ele nem sumir se ele falhar.
 */
export default function FIIMarketView({
  assetId,
  ticker,
  candleData,
  priceFormatter,
}: AssetMarketViewProps) {
  const [profile, setProfile] = useState<FIIProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [section, setSection] = useState<SectionId>('dividends')

  useEffect(() => {
    let current = true
    setLoading(true)
    setFailed(false)
    fetchFIIProfile(assetId)
      .then((result) => current && setProfile(result))
      .catch(() => current && setFailed(true))
      .finally(() => current && setLoading(false))
    return () => {
      current = false
    }
  }, [assetId])

  const sections = useMemo(() => (profile ? publishedSections(profile) : []), [profile])

  /* A aba escolhida pode não existir no próximo fundo — um de papel não tem
     "Imóveis". Sem esta queda para a primeira, a tela abriria sem painel
     nenhum e pareceria quebrada. */
  const current = sections.find((item) => item.id === section) ?? sections[0]

  return (
    <AppStack gap="md">
      {/* A faixa fica acima do gráfico, e a reserva dela também: aparecendo
          só depois da resposta, ela empurraria o gráfico para baixo com a
          tela já lida. */}
      {loading ? (
        <FIIDecisionSkeleton />
      ) : (
        profile && <FIIDecisionCard profile={profile} />
      )}

      <AssetQuoteCard
        data={candleData}
        persistKey={`market-asset:${ticker}`}
        priceFormatter={priceFormatter}
      />

      {loading && <FIISectionsSkeleton />}

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
 *  o que ele pagou, os números dele, os prédios, a carteira, o informe e o
 *  cadastro. */
function publishedSections(profile: FIIProfile): Section[] {
  const composition = profile.composition
  const hasProperties =
    (composition?.properties.length ?? 0) > 0 || profile.properties_history.length > 0

  const sections: Section[] = [
    {
      id: 'dividends',
      label: 'Rendimentos',
      // Renderizado mesmo com a lista vazia: escondê-lo faria um provedor que
      // não respondeu nada parecer uma tela que nunca foi construída, e é o
      // gráfico que diz qual dos dois é.
      content: <FIIDividendsCard dividends={profile.dividends} />,
    },
  ]

  if (profile.indicators || profile.indicators_history.length > 0) {
    sections.push({
      id: 'indicators',
      label: 'Indicadores',
      content: (
        <AppStack gap="md">
          {profile.indicators && <FIIIndicatorsCard indicators={profile.indicators} />}
          {profile.indicators_history.length > 0 && (
            <FIIIndicatorsHistoryCard history={profile.indicators_history} />
          )}
        </AppStack>
      ),
    })
  }

  if (hasProperties) {
    sections.push({
      id: 'properties',
      label: 'Imóveis',
      content: (
        <FIIPropertiesCard
          properties={composition?.properties ?? []}
          summary={composition?.summary?.properties ?? null}
          referenceDate={composition?.reference_date ?? null}
          history={profile.properties_history}
        />
      ),
    })
  }

  if (composition) {
    sections.push({
      id: 'composition',
      label: 'Carteira',
      content: (
        <FIICompositionCard
          composition={composition}
          history={profile.composition_history}
          report={profile.monthly_report}
        />
      ),
    })
  }

  if (profile.monthly_report) {
    sections.push({
      id: 'report',
      label: 'Informe mensal',
      content: <FIIMonthlyReportCard report={profile.monthly_report} />,
    })
  }

  if (profile.management || profile.indicators) {
    sections.push({
      id: 'fund',
      label: 'Fundo',
      content: (
        <FIIFundCard
          management={profile.management}
          indicators={profile.indicators}
          compositionDate={composition?.reference_date ?? null}
        />
      ),
    })
  }

  return sections
}

/** A reserva da faixa, no lugar exato onde ela vai nascer. */
function FIIDecisionSkeleton() {
  return (
    <AppCard>
      <AppStack gap="md">
        <AppSkeleton shape="text" width={90} height={22} />
        <AppStack direction="row" gap="lg" collapseBelow="md">
          <AppSkeleton shape="text" width={240} height={44} />
          <AppSkeleton shape="text" width={110} height={44} />
          <AppSkeleton shape="text" width={150} height={44} />
          <AppSkeleton shape="text" width={140} height={44} />
        </AppStack>
      </AppStack>
    </AppCard>
  )
}

/** A reserva da barra de abas e do painel que ela abre. */
function FIISectionsSkeleton() {
  return (
    <AppStack gap="md">
      <AppStack direction="row" gap="lg">
        <AppSkeleton shape="text" width={96} height={24} />
        <AppSkeleton shape="text" width={88} height={24} />
        <AppSkeleton shape="text" width={72} height={24} />
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
