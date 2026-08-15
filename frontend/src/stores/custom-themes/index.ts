import { buildMuiTheme, buildPreview, type ThemeDefinition } from '@/theme/themes'
import { create } from 'zustand'
import { withPersist } from '../middleware'
import type { CustomThemeEntry } from './types'

interface CustomThemesState {
  themes: CustomThemeEntry[]
  addTheme: (entry: Omit<CustomThemeEntry, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateTheme: (id: string, patch: Partial<Pick<CustomThemeEntry, 'name' | 'description' | 'config'>>) => void
  removeTheme: (id: string) => void
}

export const useCustomThemesStore = create<CustomThemesState>()(
  withPersist('custom-themes', (set) => ({
    themes: [],

    addTheme: (entry) => {
      const id = `custom-${Date.now()}`
      const now = Date.now()
      set((s) => ({
        themes: [...s.themes, { ...entry, id, createdAt: now, updatedAt: now }],
      }))
      return id
    },

    updateTheme: (id, patch) => {
      set((s) => ({
        themes: s.themes.map((t) =>
          t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t,
        ),
      }))
    },

    removeTheme: (id) => {
      set((s) => ({ themes: s.themes.filter((t) => t.id !== id) }))
    },
  })),
)

/** Converts all custom entries into ThemeDefinition[] for the theme registry */
export function getCustomThemeDefinitions(): ThemeDefinition[] {
  return useCustomThemesStore.getState().themes.map((entry) => ({
    id: entry.id,
    name: entry.name,
    mode: entry.config.mode,
    description: entry.description,
    preview: buildPreview(entry.config),
    theme: buildMuiTheme(entry.config),
  }))
}

export function getCustomThemeById(id: string): ThemeDefinition | undefined {
  const entry = useCustomThemesStore.getState().themes.find((t) => t.id === id)
  if (!entry) return undefined
  return {
    id: entry.id,
    name: entry.name,
    mode: entry.config.mode,
    description: entry.description,
    preview: buildPreview(entry.config),
    theme: buildMuiTheme(entry.config),
  }
}
