/* Vazios estáveis para o intervalo antes da primeira resposta.
 *
 * `?? []` cria um array novo a cada render enquanto a query não respondeu, e
 * quem depende dele num `useMemo` recalcula sempre — a mesma instabilidade
 * referencial que o cache duplo causava, por outro caminho. Uma constante por
 * forma resolve, e é o que os hooks devolvem no lugar de `undefined`. */
export const EMPTY_LIST: never[] = []
export const EMPTY_MAP: Record<string, never> = {}
