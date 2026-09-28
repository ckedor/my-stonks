import { groundLine, groundQuad, mulberry, ngon, rect, tree, type Recipe, type TreeKind } from './engine'

function grove(size: number, seed: number, dense = false): Recipe {
  return { size: [size, size], draw() {
    const random = mulberry(seed)
    groundQuad(rect(0, 0, size, size), dense ? '#4f7049' : '#6a8252')
    const spacing = dense ? 0.55 : 0.76
    for (let x = 0.35; x < size - 0.18; x += spacing) for (let y = 0.35; y < size - 0.18; y += spacing) {
      const px = x + (random() - 0.5) * 0.24, py = y + (random() - 0.5) * 0.24
      groundQuad(ngon(px, py, 0.22, 9), '#567345')
      tree(px, py, 0.62 + random() * 0.32, 0, random() < 0.25 ? 'lime' : random() < 0.15 ? 'copper' : 'canopy')
    }
  } }
}
const specimen = (kind: TreeKind, size: number): Recipe => ({ size: [1, 1], draw: () => tree(0.5, 0.5, size, 0, kind) })

export const VEGETATION_RECIPES = {
  lindenTree: specimen('lime', 1.12),
  copperTree: specimen('copper', 0.96),
  cypressTree: specimen('cypress', 1.12),
  pineTree: specimen('canopy', 1.05),
  smallGrove: grove(2, 211),
  leafyGrove: grove(3, 223),
  denseForest: grove(4, 227, true),
  gardenWalk: { size: [4, 4], draw() {
    groundQuad(rect(0, 0, 4, 4), '#6c8456')
    groundQuad([[0,1.5],[1.25,1.5],[2.5,2.3],[4,2.3],[4,2.55],[2.4,2.55],[1.15,1.75],[0,1.75]], '#c8c5af')
    groundQuad([[1.35,0],[1.57,0],[1.9,1.65],[2.4,4],[2.18,4],[1.7,1.75]], '#c8c5af')
    for (const [x,y,s] of [[.55,.55,.9],[2.6,.6,1.02],[3.4,1.1,.7],[.75,2.75,1.0],[1.6,3.45,.7],[3.2,3.3,1.1]]) tree(x,y,s,0,x>2?'lime':'canopy')
    for (const [x,y] of [[2.2,1.0],[.5,2.1],[2.9,2.9]]) {
      groundQuad(ngon(x,y,.22,12), '#87906a')
      for (let i=0;i<5;i++) tree(x+Math.cos(i*1.256)*.12,y+Math.sin(i*1.256)*.12,.20,0,'copper')
    }
  } },
  orchard: { size: [4, 4], draw() {
    groundQuad(rect(0,0,4,4), '#7c8b5d')
    for (let x=.25;x<4;x+=.56) {
      groundQuad(rect(x,0.18,.32,3.64),'#526f45')
      groundLine([x+.08,.2],[x+.08,3.8],'#a0a878',.65)
      groundLine([x+.24,.2],[x+.24,3.8],'#a0a878',.65)
      for (let y=.65;y<3.8;y+=1.0) tree(x+.16,y,.45,0,'lime')
    }
    groundQuad(rect(0,1.88,4,.16),'#c5bfa5')
  } },
} satisfies Record<string, Recipe>
