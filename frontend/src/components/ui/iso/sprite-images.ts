/** Local sprite images notify canvases and thumbnails once decoding finishes. */
let revision = 0
const listeners = new Set<() => void>()
export const spriteImageRevision = () => revision
export function subscribeSpriteImages(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export interface SpriteImage {
  image: HTMLImageElement | null
  ready: Promise<void>
}
export function loadSpriteImage(src: string): SpriteImage {
  const resource: SpriteImage = { image: null, ready: Promise.resolve() }
  if (typeof Image === 'undefined') return resource
  const image = new Image()
  resource.ready = new Promise<void>((resolve, reject) => {
    image.onload = () => {
      resource.image = image
      revision++
      listeners.forEach(listener => listener())
      resolve()
    }
    image.onerror = () => reject(new Error(`Não foi possível carregar a escultura: ${src}`))
    image.src = src
  })
  // Interactive canvases render other pieces while loading; export can await
  // the original promise and report a failed image instead of saving a blank.
  void resource.ready.catch(() => {})
  return resource
}
