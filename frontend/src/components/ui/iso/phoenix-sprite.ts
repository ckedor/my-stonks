import imageUrl from '@/assets/sculptures/phoenix.png'
import { loadSpriteImage } from './sprite-images'

/** Approved fixed-view cutout. Colors and pose are part of the artwork. */
export const phoenixSprite = loadSpriteImage(imageUrl)
export const PHOENIX_SPAN = 2.2
// Exclude the transparent margin at top and bottom, without resampling pixels.
export const PHOENIX_CROP: [number, number, number, number] = [0, 19, 1254, 1199]
