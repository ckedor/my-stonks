import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadSpriteImage, spriteImageRevision, subscribeSpriteImages } from './sprite-images'

afterEach(() => vi.unstubAllGlobals())

describe('imagens das esculturas', () => {
  it('invalida sprites feitos antes de a imagem terminar de carregar', async () => {
    const image: { onload?: () => void; src: string } = { src: '' }
    vi.stubGlobal('Image', vi.fn(function () { return image }))
    const before = spriteImageRevision(), listener = vi.fn()
    const unsubscribe = subscribeSpriteImages(listener)
    const resource = loadSpriteImage('/phoenix.png')
    expect(resource.image).toBeNull()
    expect(listener).not.toHaveBeenCalled()
    image!.onload!()
    await resource.ready
    expect(resource.image).toBe(image!)
    expect(spriteImageRevision()).toBe(before + 1)
    expect(listener).toHaveBeenCalledOnce()
    unsubscribe()
  })

  it('reporta falha no export em vez de salvar uma escultura invisível', async () => {
    let fail: () => void
    vi.stubGlobal('Image', class {
      src = ''
      set onerror(handler: () => void) { fail = handler }
    })
    const resource = loadSpriteImage('/missing.png')
    fail!()
    await expect(resource.ready).rejects.toThrow('Não foi possível carregar')
    expect(resource.image).toBeNull()
  })
})
