import { AppBulletList, AppStack, AppText, SectionLabel } from '@/components/ui'

/* O que o PGBL é, para quem chega na tela sem saber por que aportaria nele.
 *
 * Fica junto da conta e não numa ajuda escondida: a tela devolve um número
 * que parece dinheiro de graça, e sem o parágrafo do resgate ele é lido como
 * tal. O texto existe para dizer o que a conta não diz. */

export default function HowPgblWorks() {
  return (
    <AppStack gap="md">
      <AppText variant="body">
        O PGBL não é um investimento diferente dos outros: é uma embalagem
        fiscal. Tudo o que entra nele durante o ano{' '}
        <AppText inline weight="strong">
          abate da base do imposto de renda
        </AppText>
        , até o limite de 12% de tudo o que você recebeu de tributável no ano.
        Aportar R$ 24.000 num salário de R$ 200.000 é declarar que sua renda
        foi de R$ 176.000 — e o imposto é cobrado sobre esse número menor.
      </AppText>

      <AppStack gap="xs">
        <SectionLabel>As três condições</SectionLabel>
        <AppBulletList
          variant="body"
          items={[
            'Declaração completa. No desconto simplificado, os 20% substituem todas as deduções e o PGBL não abate nada — é a regra que mais derruba o plano de quem aporta sem conferir.',
            'Contribuição ao INSS. Requisito legal do abatimento; um CLT cumpre por folha de pagamento.',
            'O aporte tem de cair dentro do ano-calendário. Depositado em 2 de janeiro, ele abate do imposto do ano que começa.',
          ]}
        />
      </AppStack>

      <AppStack gap="xs">
        <SectionLabel>O que você está adiando, e não ganhando</SectionLabel>
        <AppText variant="body">
          No resgate, o imposto incide sobre{' '}
          <AppText inline weight="strong">
            o valor total sacado
          </AppText>
          , e não só sobre o rendimento — foi isso que você deixou de pagar
          agora. O PGBL vale a pena quando a alíquota do resgate for menor que
          a que você deixou de pagar hoje, e é para isso que serve a tabela
          regressiva: escolhida na contratação, ela cai de 35% para 10% conforme
          o dinheiro envelhece, chegando aos 10% depois de dez anos. Resgatar
          cedo, na tabela progressiva ou nos primeiros anos da regressiva,
          desfaz o ganho.
        </AppText>
      </AppStack>

      <AppStack gap="xs">
        <SectionLabel>O irmão que não serve aqui</SectionLabel>
        <AppText variant="body">
          O VGBL é o contrário: não abate nada da base, e em troca o imposto no
          resgate incide só sobre o rendimento. Ele é para quem declara no
          simplificado ou já esgotou os 12% — nada do que esta tela calcula se
          aplica a ele.
        </AppText>
      </AppStack>

      <AppText variant="bodySmall" tone="secondary">
        A taxa do fundo escolhido come parte do ganho fiscal ano após ano. Uma
        taxa de administração alta transforma o melhor abatimento do país num
        empate — a restituição desta tela é o teto do que a embalagem oferece,
        antes do que o produto cobra.
      </AppText>
    </AppStack>
  )
}
