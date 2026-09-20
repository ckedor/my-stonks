import type { FundRegistryClass } from '@/api/fundRegistry'
import { AppGrid, AppGridItem, AppStack, AppText } from '@/components/ui'
import { formatCnpj, formatDate, formatNumber, orDash, yesNo } from './fundRegistryFormat'

/* O que o cadastro da CVM diz de uma classe, só para leitura. Nada aqui é
   editável: o cadastro é do regulador, e a importação semanal o reescreve. */
export function FundRegistryFacts({ registryClass }: { registryClass: FundRegistryClass }) {
  const fund = registryClass.fund
  const facts: [string, string][] = [
    ['Fundo', orDash(fund?.name)],
    ['Tipo', orDash(fund?.kind)],
    ['CNPJ da classe', formatCnpj(registryClass.cnpj)],
    ['Situação', orDash(registryClass.status)],
    ['Administrador', orDash(fund?.administrator_name)],
    ['Gestor', orDash(fund?.manager_name)],
    ['Classificação', orDash(registryClass.classification)],
    ['Classificação ANBIMA', orDash(registryClass.anbima_classification)],
    ['Condomínio', registryClass.open_ended === null ? '—' : registryClass.open_ended ? 'Aberto' : 'Fechado'],
    ['Exclusivo', yesNo(registryClass.exclusive)],
    ['Público-alvo', orDash(registryClass.target_investors)],
    ['Custodiante', orDash(registryClass.custodian_name)],
    ['Auditor', orDash(registryClass.auditor_name)],
    ['Patrimônio líquido', `${formatNumber(registryClass.equity)} (${formatDate(registryClass.equity_date)})`],
    ['Taxa de administração (%)', formatNumber(registryClass.admin_fee, 4)],
    [
      'Taxa de performance (%)',
      registryClass.performance_fee === null
        ? '—'
        : `${formatNumber(registryClass.performance_fee, 4)} ${registryClass.performance_benchmark ?? ''}`.trim(),
    ],
    ['Aplicação mínima', formatNumber(registryClass.minimum_investment)],
    ['Conversão do resgate (dias úteis)', orDash(registryClass.conversion_days)],
    ['Pagamento do resgate (dias)', orDash(registryClass.redemption_payment_days)],
    ['Condições informadas em', formatDate(registryClass.terms_date)],
  ]
  return (
    <AppGrid cols={2} gap="sm">
      {facts.map(([label, value]) => (
        <AppGridItem key={label}>
          <AppStack>
            <AppText variant="caption" tone="secondary">
              {label}
            </AppText>
            <AppText variant="bodySmall">{value}</AppText>
          </AppStack>
        </AppGridItem>
      ))}
    </AppGrid>
  )
}
