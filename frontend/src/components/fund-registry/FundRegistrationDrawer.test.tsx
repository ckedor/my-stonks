import { fireEvent, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithTheme } from '@/theme/test-render'
import { registerFund, searchFundRegistry, fetchFundSeriesFiling } from '@/api/fundRegistry'
import type { Asset } from '@/types'
import AssetSelector from '../AssetSelector'
import { FundRegistrationDrawer } from './FundRegistrationDrawer'

const fixture = vi.hoisted(() => ({
  registered: false,
  asset: { id: 42, name: 'PLGN EQUIPE - Senior', ticker: null, asset_type_id: 7 },
  registryClass: {
    id: 31, cnpj: '55139905000139', name: 'PLGN EQUIPE',
    fund: { kind: 'FIDC', name: 'PLGN EQUIPE' },
  },
  senior: { label: 'Senior', shares: 100, share_value: 1.42, has_shares: true },
}))

vi.mock('@/api/assets', () => ({
  fetchAssets: async () => fixture.registered ? [fixture.asset] : [],
  fetchAssetTypes: async () => [{ id: 7, short_name: 'FI', asset_class_id: 2 }],
  fetchAsset: async () => fixture.asset,
}))

vi.mock('@/api/fundRegistry', () => ({
  searchFundRegistry: vi.fn(async () => [fixture.registryClass]),
  fetchFundRegistryClass: async () => ({
    registry_class: fixture.registryClass, subclasses: [], series: [], registered_units: [],
  }),
  fetchFundSeriesFiling: vi.fn(),
  registerFund: vi.fn(async () => {
    fixture.registered = true
    return { id: 42 }
  }),
  selectFundSeries: vi.fn(),
  confirmFundSeriesAliases: vi.fn(),
}))

function PurchaseAsset() {
  const [asset, setAsset] = useState<Asset | null>(null)
  return <AssetSelector value={asset?.id ?? null} onChange={setAsset} />
}

beforeEach(() => {
  vi.clearAllMocks()
  fixture.registered = false
  vi.mocked(fetchFundSeriesFiling).mockResolvedValue({
    fund_registry_class_id: 31, applicable: true, filing_date: '2026-07-31',
    candidates: [fixture.senior], searched_from: '2026-07-01', searched_to: '2026-08-31', files_read: 2,
  })
})

describe('fund registration from a purchase', () => {
  it('keeps the typed CNPJ, confirms the sole series and selects the tickerless fund', async () => {
    renderWithTheme(<PurchaseAsset />)
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Tipo de Ativo' }))
    fireEvent.click(await screen.findByRole('option', { name: 'FI' }))
    const input = screen.getByRole('combobox', { name: 'Ativo' })
    await waitFor(() => expect(input).not.toBeDisabled())
    fireEvent.change(input, { target: { value: '55.139.905/0001-39' } })
    fireEvent.click(await screen.findByText('Buscar fundo por CNPJ…'))
    expect(await screen.findByLabelText('CNPJ ou nome do fundo')).toHaveValue('55.139.905/0001-39')
    fireEvent.click(await screen.findByText('PLGN EQUIPE'))
    const confirm = screen.getByRole('button', { name: 'Confirmar fundo' })
    await waitFor(() => expect(confirm).toBeEnabled())
    fireEvent.click(confirm)
    await waitFor(() => expect(registerFund).toHaveBeenCalledWith({
      fund_registry_class_id: 31, asset_type_id: 7, fund_registry_subclass_id: null,
      series_id: null, series_label: 'Senior',
    }))
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Ativo' })).toHaveValue('PLGN EQUIPE - Senior'))
    expect(searchFundRegistry).toHaveBeenCalledWith('55.139.905/0001-39')
  })

  it('requires a choice when more than one series has shares', async () => {
    vi.mocked(fetchFundSeriesFiling).mockResolvedValue({
      fund_registry_class_id: 31, applicable: true, filing_date: '2026-07-31',
      candidates: [fixture.senior, { ...fixture.senior, label: 'Subordinada' }],
      searched_from: null, searched_to: null, files_read: 1,
    })
    renderWithTheme(<FundRegistrationDrawer open initialClassId={31} onClose={vi.fn()} onRegistered={vi.fn()} />)
    expect(await screen.findByRole('combobox', { name: 'Série de cotas' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Confirmar fundo' })).toBeDisabled()
    expect(registerFund).not.toHaveBeenCalled()
  })
})
