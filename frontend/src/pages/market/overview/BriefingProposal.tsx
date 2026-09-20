import { useState } from 'react'
import {
  AppButton,
  AppCard,
  AppChip,
  AppDivider,
  AppGrid,
  AppGridItem,
  AppStack,
  AppTabs,
  AppText,
  SectionLabel,
  SectionTitle,
} from '@/components/ui'
import { markets, scenarios, stories } from './mockData'
import { AgendaList, MarketTile, StoryRow, type OpenDetail } from './MarketPieces'

const NEWS_TABS = [
  { id: 'all', label: 'Tudo' },
  { id: 'br', label: 'Brasil' },
  { id: 'world', label: 'Mundo' },
]

export default function BriefingProposal({ onOpen }: { onOpen: OpenDetail }) {
  const [newsRegion, setNewsRegion] = useState('all')
  const [scenarioId, setScenarioId] = useState('base')
  const scenario = scenarios.find((item) => item.id === scenarioId)!
  const news = stories.filter((story) => newsRegion === 'all' || story.region === newsRegion)
  return (
    <AppStack gap="xl">
      <AppGrid cols={{ xs: 1, lg: 12 }} gap="lg" align="stretch">
        <AppGridItem span={{ xs: 1, lg: 8 }}>
          <AppCard padding="lg">
            <AppStack gap="lg">
              <AppStack direction="row" justify="between" align="center" gap="sm" wrap>
                <SectionLabel>A LEITURA DO MÊS</SectionLabel>
                <AppText variant="caption" tone="secondary">
                  Maio de 2026 · 3 min
                </AppText>
              </AppStack>
              <SectionTitle prominence="lead">
                O dinheiro continua caro. O mercado escolhe onde correr risco.
              </SectionTitle>
              <AppText tone="secondary">
                As bolsas avançam sem caminhar juntas. Tecnologia lidera nos EUA; no Brasil, o juro
                alto segue como referência. Por trás dos preços, a mesma pergunta: quando a inflação
                dará espaço para um alívio?
              </AppText>
              <AppDivider />
              <AppGrid cols={{ xs: 1, sm: 2 }} gap="lg">
                <AppStack gap="sm">
                  <SectionLabel>BRASIL</SectionLabel>
                  <SectionTitle>À espera de uma virada nos juros</SectionTitle>
                  <AppText variant="bodySmall" tone="secondary">
                    Bolsa e FIIs recuperam parte do terreno, mas o CDI mantém a régua alta. Inflação
                    e contas públicas continuam no radar.
                  </AppText>
                </AppStack>
                <AppStack gap="sm">
                  <SectionLabel>MUNDO</SectionLabel>
                  <SectionTitle>Uma alta com protagonistas definidos</SectionTitle>
                  <AppText variant="bodySmall" tone="secondary">
                    Tecnologia e Bitcoin se destacam. O dólar forte e a queda do petróleo mostram
                    que o apetite por risco está longe de ser uniforme.
                  </AppText>
                </AppStack>
              </AppGrid>
              <AppStack direction="row">
                <AppButton emphasis="outline" onClick={() => onOpen(stories[0])}>
                  Aprofundar a leitura →
                </AppButton>
              </AppStack>
            </AppStack>
          </AppCard>
        </AppGridItem>
        <AppGridItem span={{ xs: 1, lg: 4 }}>
          <AppCard padding="lg">
            <AppStack gap="lg">
              <SectionLabel>SE VOCÊ SÓ TIVER 30 SEGUNDOS</SectionLabel>
              {[
                {
                  number: '01',
                  title: 'O que ganhou força',
                  text: 'Tecnologia e cripto lideraram. A alta das bolsas ainda depende de poucos motores.',
                  detail: stories[2],
                },
                {
                  number: '02',
                  title: 'O que segue travando',
                  text: 'Juros elevados continuam exigindo mais dos lucros e dos investimentos.',
                  detail: stories[1],
                },
                {
                  number: '03',
                  title: 'O que pode mudar a conversa',
                  text: 'As próximas leituras de inflação e emprego podem reorganizar as expectativas.',
                  detail: stories[0],
                },
              ].map(({ number, title, text, detail }) => (
                <AppStack key={number} gap="xs">
                  <AppText variant="caption" tone="secondary">
                    {number}
                  </AppText>
                  <SectionTitle>{title}</SectionTitle>
                  <AppText variant="bodySmall" tone="secondary">
                    {text}
                  </AppText>
                  <AppStack direction="row">
                    <AppButton size="sm" emphasis="ghost" onClick={() => onOpen(detail)}>
                      Entender →
                    </AppButton>
                  </AppStack>
                </AppStack>
              ))}
            </AppStack>
          </AppCard>
        </AppGridItem>
      </AppGrid>

      <AppStack gap="md">
        <AppStack direction="row" justify="between" align="center" gap="sm" wrap>
          <AppStack gap="xs">
            <SectionLabel>OS PREÇOS CONTAM A HISTÓRIA</SectionLabel>
            <SectionTitle>Brasil e mundo, lado a lado</SectionTitle>
          </AppStack>
          <AppText variant="caption" tone="secondary">
            Variação no mês · moedas de origem
          </AppText>
        </AppStack>
        <AppGrid cols={{ xs: 1, sm: 2, lg: 4 }} gap="md">
          {['ibov', 'ifix', 'sp500', 'oil'].map((id) => (
            <MarketTile
              key={id}
              market={markets.find((m) => m.id === id)!}
              period="month"
              onOpen={onOpen}
            />
          ))}
        </AppGrid>
      </AppStack>

      <AppGrid cols={{ xs: 1, lg: 12 }} gap="xl" align="start">
        <AppGridItem span={{ xs: 1, lg: 8 }}>
          <AppStack gap="lg">
            <AppStack gap="xs">
              <SectionLabel>ALÉM DAS MANCHETES</SectionLabel>
              <SectionTitle>As notícias que merecem contexto</SectionTitle>
              <AppText variant="bodySmall" tone="secondary">
                O que aconteceu, por que importa e o que ainda está em aberto.
              </AppText>
            </AppStack>
            <AppTabs
              items={NEWS_TABS}
              value={newsRegion}
              onChange={setNewsRegion}
              label="Região das notícias"
            />
            {news.map((story, index) => (
              <StoryRow
                key={story.id}
                story={story}
                onOpen={onOpen}
                number={String(index + 1).padStart(2, '0')}
              />
            ))}
          </AppStack>
        </AppGridItem>
        <AppGridItem span={{ xs: 1, lg: 4 }}>
          <AppCard padding="lg">
            <AgendaList onOpen={onOpen} />
          </AppCard>
        </AppGridItem>
      </AppGrid>

      <AppCard padding="lg">
        <AppStack gap="lg">
          <AppStack direction="row" justify="between" gap="sm" wrap>
            <AppStack gap="xs">
              <SectionLabel>OLHANDO PARA A FRENTE</SectionLabel>
              <SectionTitle>Três caminhos possíveis</SectionTitle>
            </AppStack>
            <AppChip label="Horizonte · 3–6 meses" emphasis="outline" />
          </AppStack>
          <AppTabs
            items={scenarios.map((s) => ({ id: s.id, label: s.title }))}
            value={scenarioId}
            onChange={setScenarioId}
            label="Cenário econômico"
          />
          <AppGrid cols={{ xs: 1, md: 3 }} gap="lg">
            <AppStack gap="sm">
              <SectionLabel>{scenario.label}</SectionLabel>
              <AppText weight="strong">{scenario.summary}</AppText>
              <AppStack direction="row">
                <AppButton emphasis="ghost" onClick={() => onOpen(scenario)}>
                  Explorar o cenário →
                </AppButton>
              </AppStack>
            </AppStack>
            <AppStack gap="sm">
              <SectionTitle>O que sustentaria essa leitura</SectionTitle>
              <AppText variant="bodySmall" tone="secondary">
                {scenario.trigger}
              </AppText>
              <AppText variant="caption" tone="secondary">
                No radar: {scenario.affected}
              </AppText>
            </AppStack>
            <AppStack gap="sm">
              <SectionTitle>O que faria repensar</SectionTitle>
              <AppText variant="bodySmall" tone="secondary">
                {scenario.counter}
              </AppText>
              <AppText variant="caption" tone="secondary">
                Hipóteses condicionais, sem probabilidades atribuídas.
              </AppText>
            </AppStack>
          </AppGrid>
        </AppStack>
      </AppCard>
    </AppStack>
  )
}
