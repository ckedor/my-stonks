import { fetchFavoriteAssets } from '@/api/market'
import { renderWithTheme } from '@/theme/test-render'
import { screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FavoriteAssets from './FavoriteAssets'

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock('@/api/market', () => ({
  fetchFavoriteAssets: vi.fn(),
}))

vi.mock('@/stores/favorites', () => ({
  useFavoritesStore: () => ({ favorites: [], refresh: mocks.refresh }),
}))

describe('FavoriteAssets', () => {
  beforeEach(() => vi.mocked(fetchFavoriteAssets).mockReset())

  it('asks the backend to rank only assets in the page universe', async () => {
    vi.mocked(fetchFavoriteAssets).mockResolvedValue([{
      id: 42,
      ticker: 'BOVA11',
      name: 'iShares Ibovespa',
      asset_type_id: 1,
      asset_type: { id: 1, short_name: 'ETF', name: 'Exchange Traded Fund' },
      logo_url: null,
      visit_count: 5,
      last_visited_at: '2026-08-22T12:00:00Z',
    }])

    renderWithTheme(
      <MemoryRouter>
        <FavoriteAssets limit={8} assetTypeId={1} assetIds={[42, 47]} />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(fetchFavoriteAssets).toHaveBeenCalledWith(8, 1, [42, 47])
    })
    expect(screen.getByText('BOVA11')).toBeVisible()
  })

  it('does not fall back to every ETF when the page has no registered assets', () => {
    renderWithTheme(
      <MemoryRouter>
        <FavoriteAssets limit={8} assetTypeId={1} assetIds={[]} />
      </MemoryRouter>,
    )

    expect(fetchFavoriteAssets).not.toHaveBeenCalled()
    expect(screen.queryByText('Mais acessados')).not.toBeInTheDocument()
  })
})
