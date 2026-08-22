/* A lista de benchmarks vira opções de `AppSelect`.
 *
 * Mora fora dos dois formulários que a usam porque os dois precisam
 * concordar: o valor que representa "nenhum benchmark" é o mesmo string
 * vazio dos dois lados, e um deles mudando sozinho é um bug silencioso —
 * a categoria salva com `benchmark_id` que não existe. */

export interface BenchmarkOption {
  id: number
  short_name: string
}

/** Valor da opção "sem benchmark". `AppSelect` fala em string. */
export const NO_BENCHMARK = ''

export function benchmarkOptions(benchmarks: BenchmarkOption[]) {
  return [
    { value: NO_BENCHMARK, label: 'Sem Benchmark' },
    ...benchmarks.map((b) => ({ value: String(b.id), label: b.short_name })),
  ]
}
