import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ThemeRegistry } from '@/theme'
import AssetList from './AssetList'
import type { AssetListView } from './view-state'

vi.mock('@/queries/portfolio', () => ({
  useSelectedPortfolio: () => ({ id: 1, custom_categories: [] }),
  useRefreshPortfolio: () => vi.fn(),
}))
vi.mock('@/hooks/useAssetReturnWindow', () => ({
  useAssetReturnWindow: () => ({ values: [0, 1], period: null }),
}))

const fund = {
  asset_id: 13499,
  ticker: null,
  name: 'PLGN EQUIPE FUNDO DE INVESTIMENTO',
  quantity: 2,
  price: 20000,
  value: 40000,
  category: '',
  class: 'Renda Variável',
  type: 'FI',
  twelve_months_return: 0,
  acc_return: 0,
}

function list(view: AssetListView, search = '', name: string | undefined = fund.name) {
  return render(
    <ThemeRegistry>
      <MemoryRouter>
        <AssetList positions={[{ ...fund, name }]} groupBy="category" search={search} view={view} />
      </MemoryRouter>
    </ThemeRegistry>,
  )
}

describe.each<AssetListView>(['list', 'card'])('tickerless fund in %s view', (view) => {
  it('shows the fund when search is empty', () => {
    list(view)
    expect(screen.getByText(fund.name)).toBeInTheDocument()
  })

  it('finds the fund by name regardless of case', () => {
    list(view, 'eQuIpE')
    expect(screen.getByText(fund.name)).toBeInTheDocument()
  })

  it('excludes a fund that does not match the search', () => {
    list(view, 'PETR4')
    expect(screen.queryByText(fund.name)).not.toBeInTheDocument()
  })
})
