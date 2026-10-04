import {
  AppButton,
  AppCard,
  AppChartSkeleton,
  AppPageHeaderSkeleton,
  AppSkeleton,
  AppStack,
  AppTableSkeleton,
} from '@/components/ui'
import { Entry, State, States } from './Specimen'

/* O `LoadingSpinner` não aparece aqui: a regra do ESLint o reprova em
 * `src/pages/**`, e é por isso que ele mora nos controles — o `loading` do
 * AppButton, abaixo, é o lugar dele. */

export default function WaitFamily() {
  return (
    <AppStack gap="lg">
      <Entry
        name="AppSkeleton"
        role="A peça da reserva. Uma tela inteira se reserva com um *Skeleton ao lado dela, feito destas."
      >
        <States label="shape">
          <State label="text">
            <AppSkeleton shape="text" width={160} height={16} />
          </State>
          <State label="rounded">
            <AppSkeleton width={160} height={48} />
          </State>
          <State label="pill">
            <AppSkeleton shape="pill" width={90} height={24} />
          </State>
          <State label="circle">
            <AppSkeleton shape="circle" width={40} height={40} />
          </State>
        </States>
      </Entry>

      <Entry name="AppPageHeaderSkeleton" role="A reserva do AppPageHeader, com as mesmas partes opcionais.">
        <AppStack gap="lg">
          <State label="só o título">
            <AppPageHeaderSkeleton />
          </State>
          <State label="breadcrumbs · description · actions=2 · metrics=3">
            <AppPageHeaderSkeleton breadcrumbs description actions={2} metrics={3} />
          </State>
        </AppStack>
      </Entry>

      <Entry name="AppTableSkeleton" role="A reserva de qualquer tabela: cabeçalho e linhas.">
        <States columns={2}>
          <State label="surface=none · dentro de um card">
            <AppCard>
              <AppTableSkeleton columns={4} rows={4} />
            </AppCard>
          </State>
          <State label="surface=card">
            <AppTableSkeleton columns={4} rows={4} surface="card" />
          </State>
        </States>
      </Entry>

      <Entry name="AppChartSkeleton" role="A reserva de um gráfico: barra de controles e área.">
        <States columns={2}>
          <State label="toolbar · surface=card">
            <AppChartSkeleton height={160} toolbar surface="card" />
          </State>
          <State label="sem toolbar · dentro de um card">
            <AppCard>
              <AppChartSkeleton height={160} />
            </AppCard>
          </State>
        </States>
      </Entry>

      <Entry
        name="Espera de uma ação"
        role="A espera em linha de uma ação disparada por alguém mora no controle: o loading do AppButton põe o disco no lugar do ícone e mantém o rótulo."
      >
        <States>
          <State label="AppButton loading">
            <AppButton loading>Recalculando</AppButton>
          </State>
          <State label="outline · loading">
            <AppButton emphasis="outline" loading>
              Importando
            </AppButton>
          </State>
        </States>
      </Entry>
    </AppStack>
  )
}
