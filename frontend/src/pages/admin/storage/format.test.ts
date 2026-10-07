import { describe, expect, it } from 'vitest'

import { formatBytes } from './format'

describe('formatBytes', () => {
  it('writes each size in the unit it is read in', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(8192)).toBe('8 KB')
    expect(formatBytes(1536)).toBe('1,5 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB')
    expect(formatBytes(123 * 1024 * 1024)).toBe('123 MB')
    expect(formatBytes(2.5 * 1024 ** 3)).toBe('2,5 GB')
  })
})
