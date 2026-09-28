import type { EtfProfile } from '@/api/etf'

/* Como a tela de ETF escreve os códigos que os reguladores publicam. */

const REGIONS = new Intl.DisplayNames(['pt-BR'], { type: 'region' })

/** "US" → "Estados Unidos". Um código que o navegador não conhece fica como veio. */
export function countryName(code: string | null | undefined): string | null {
  if (!code) return null
  try {
    return REGIONS.of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}

/** A categoria que o N-PORT dá a cada posição. */
const ASSET_CATEGORY: Record<string, string> = {
  EC: 'Ação',
  EP: 'Ação preferencial',
  DBT: 'Dívida',
  STIV: 'Caixa e equivalentes',
  DE: 'Derivativo de ações',
  DIR: 'Derivativo de juros',
  DFE: 'Derivativo de câmbio',
  DCR: 'Derivativo de crédito',
  DCO: 'Derivativo de commodity',
  DO: 'Outro derivativo',
  RE: 'Imobiliário',
  LON: 'Empréstimo',
  SN: 'Nota estruturada',
}

export function assetCategoryLabel(code: string | null | undefined): string | null {
  if (!code) return null
  if (code.startsWith('ABS')) return 'Securitização'
  return ASSET_CATEGORY[code] ?? 'Outro'
}

export const REGISTRY_LABEL: Record<NonNullable<EtfProfile['registry']>, string> = {
  sec: 'SEC (EUA)',
  esma: 'ESMA (UE)',
  cvm: 'CVM (Brasil)',
}

export const DISTRIBUTION_LABEL: Record<
  NonNullable<NonNullable<EtfProfile['share_class']>['distribution_policy']>,
  string
> = {
  accumulating: 'Acumula proventos',
  distributing: 'Distribui proventos',
  mixed: 'Acumula e distribui',
}

export const HOLDINGS_SOURCE_LABEL: Record<string, string> = {
  sec_nport: 'N-PORT da SEC',
}
