import { applyPresetChange, PRESET_FILE_ENDPOINT } from './preset-file'
import { sourceFileWriter } from './source-writer'

/* O estúdio de temas salva os presets direto em `frontend/src/theme/presets.ts`,
   por meio de `applyPresetChange`. */
export const themePresetWriter = (file: string) =>
  sourceFileWriter('theme-preset-writer', PRESET_FILE_ENDPOINT, file, applyPresetChange)
