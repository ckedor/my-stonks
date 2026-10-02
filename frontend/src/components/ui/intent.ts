/* O vocabulário de intenção do design system: um nome por intenção, em todo
 * componente que tem tom.
 *
 * A mesma falha se escrevia de três jeitos — `tone="danger"` no botão,
 * `tone="error"` no botão de ícone e `severity="error"` no aviso —, porque
 * cada componente herdava o nome do MUI que embrulhava. Quem chama não deve
 * precisar lembrar qual componente veio de qual palavra: cada um aceita um
 * recorte desta lista (`Extract<Intent, ...>`), e a tradução para a paleta do
 * MUI mora aqui, uma vez. */

export type Intent = 'primary' | 'info' | 'success' | 'caution' | 'danger'

/** A cor de paleta do MUI de cada intenção. */
export const INTENT_COLOR = {
  primary: 'primary',
  info: 'info',
  success: 'success',
  caution: 'warning',
  danger: 'error',
} as const satisfies Record<Intent, string>
