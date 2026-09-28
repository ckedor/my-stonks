/* O território: onde se pode construir, conforme a patente.

   O jogo começa numa das ilhas menores, e cada expansão abre mais um
   pedaço do arquipélago — uma ilha, um grupo de ilhas. É um evento raro: meia
   dúzia de vezes no jogo inteiro, e a última abre o mapa todo. O que já
   estava construído fora do território fica onde está; só o que é novo
   precisa caber nele.

   A escala é o parâmetro do jogo, e mora só aqui: para mudar quando uma
   área abre, troque o `fromRank`; para abrir em outra ordem, troque as
   regiões de lugar. As regiões em si são desenho do mapa, em `map.ts`. */

import { CITY_REGIONS, type CityRegion } from './map'
import { CITY_TIERS, type CityTier } from './tiers'

export interface TerritoryStage {
  /** A patente a partir da qual a área abre — o `rank` em `CITY_TIERS`. */
  fromRank: number
  /** Como o jogador a conhece. */
  name: string
  /** O que ela acrescenta ao território. `all` abre o mapa inteiro. */
  regions: CityRegion[] | 'all'
}

export const TERRITORY_STAGES: TerritoryStage[] = [
  { fromRank: 1, name: 'Ilhota do Sul', regions: ['south-cay'] },
  { fromRank: 5, name: 'Ilhas do Sul', regions: ['south-isles'] },
  { fromRank: 11, name: 'Ilhas do Leste', regions: ['east-isles'] },
  { fromRank: 18, name: 'Ilha Grande', regions: ['big-island'] },
  { fromRank: 24, name: 'Ilhas do Deserto', regions: ['desert-isles'] },
  { fromRank: 31, name: 'Ilha da Praia e a ilhota', regions: ['beach-island', 'strait-islet'] },
  { fromRank: 39, name: 'Ilhas do Norte', regions: ['north-isles'] },
  { fromRank: 48, name: 'O arquipélago inteiro', regions: 'all' },
]

export interface Territory {
  /** As áreas já abertas, na ordem em que abriram. */
  opened: TerritoryStage[]
  /** A próxima área, e a patente que a abre. */
  next: { stage: TerritoryStage; tier: CityTier } | null
  /** Onde se pode construir, em tiles. `undefined` é o mapa inteiro. */
  buildable: [number, number][][] | undefined
}

export function territoryOf(
  rank: number,
  stages: TerritoryStage[] = TERRITORY_STAGES,
  tiers: CityTier[] = CITY_TIERS,
): Territory {
  const opened = stages.filter(stage => stage.fromRank <= rank)
  const upcoming = stages.find(stage => stage.fromRank > rank)
  const tier = upcoming && tiers.find(candidate => candidate.rank === upcoming.fromRank)
  const regions = opened.flatMap(stage => stage.regions === 'all' ? [] : stage.regions)
  return {
    opened,
    next: upcoming && tier ? { stage: upcoming, tier } : null,
    buildable: opened.some(stage => stage.regions === 'all') ? undefined : regions.flatMap(region => CITY_REGIONS[region]),
  }
}
