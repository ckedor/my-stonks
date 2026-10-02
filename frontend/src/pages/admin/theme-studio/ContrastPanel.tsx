import { AppChip, AppSimpleTable } from '@/components/ui'
import { paletteContrastChecks, type ContrastCheck } from '@/theme/contrast'
import type { ThemePaletteConfig } from '@/theme/themes'

/* As réguas de contraste do tema em edição, ao vivo. As marcadas como
 * "o teste reprova" são exatamente as de `themes.test.ts`: um preset que
 * falha nelas não entra no catálogo. As outras são conselho. */

const passes = (check: ContrastCheck) => check.ratio != null && check.ratio >= check.min

export default function ContrastPanel({ palette }: { palette: ThemePaletteConfig }) {
  return (
    <AppSimpleTable
      rows={paletteContrastChecks(palette)}
      getRowKey={(check) => check.label}
      columns={[
        { label: 'Régua', render: (check) => check.label },
        {
          label: 'Contraste',
          align: 'right',
          render: (check) => (check.ratio != null ? `${check.ratio.toFixed(2)}:1` : 'não medido'),
        },
        { label: 'Mínimo', align: 'right', render: (check) => `${check.min}:1` },
        {
          label: 'Peso',
          hint: 'O teste de tema reprova o preset que falha numa régua obrigatória.',
          render: (check) => (check.enforced ? 'o teste reprova' : 'conselho'),
        },
        {
          label: 'Situação',
          render: (check) =>
            passes(check) ? (
              <AppChip label="passa" tone="success" />
            ) : (
              <AppChip label="falha" tone={check.enforced ? 'danger' : 'caution'} />
            ),
        },
      ]}
    />
  )
}
