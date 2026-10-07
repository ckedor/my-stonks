/* Tamanhos em bytes, na unidade que se lê de relance: o banco cresce em
 * megabytes, e uma tabela pequena em quilobytes. Base 1024, como o próprio
 * Postgres imprime. */

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

export function formatBytes(bytes: number): string {
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit += 1
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: digits })} ${UNITS[unit]}`
}
