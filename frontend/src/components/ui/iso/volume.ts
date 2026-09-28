import { recipeMeasure, type Recipe } from './engine'
import { ISO_RECIPES, type IsoRecipeKey } from './recipes'

/** The built volume of a piece, in m³, and its height, in m, whether its
 *  drawing is one of the catalogue's or generated. */
export const isoPieceMeasure = (recipe: IsoRecipeKey | Recipe) =>
  recipeMeasure(typeof recipe === 'string' ? ISO_RECIPES[recipe] : recipe)

export const isoPieceVolume = (recipe: IsoRecipeKey | Recipe) => isoPieceMeasure(recipe).volume

/** The tile footprint used by the builder's placement and collision rules. */
export const isoPieceSize = (recipe: IsoRecipeKey | Recipe) =>
  (typeof recipe === 'string' ? ISO_RECIPES[recipe] : recipe).size
