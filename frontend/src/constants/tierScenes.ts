/* Os cenários da escala: um arquivo por degrau, versionado ao lado do código.
 *
 * A escala continua sendo dado — nome e alvo saem do banco, editáveis pelo
 * admin —, mas a imagem não. Um cenário é arte do produto, do tamanho de um
 * fundo de tela, e guardá-lo no banco significaria carregar megabytes de
 * base64 em toda listagem da escala para mostrar um deles por vez.
 *
 * A ligação entre a linha e o arquivo é a posição na escala, e não o `id` nem
 * o `rank`: a escala é percorrida do primeiro degrau ao último, e o primeiro
 * cenário é o do primeiro degrau. Renumerar um rank no admin não desalinha a
 * galeria; reordenar a escala reordena os cenários junto, que é o que se quer.
 *
 * São cinquenta, um por degrau da escala fixa do backend. Para acrescentar um
 * cenário, basta soltar o arquivo em `assets/tiers` com a posição na frente do
 * nome — `07-vila.png`. Nada aqui precisa mudar; enquanto o arquivo não
 * existe, o degrau é um lugar ainda por desenhar, e não um erro.
 */

const files = import.meta.glob<string>('../assets/tiers/*.{png,jpg,jpeg,webp}', {
  eager: true,
  import: 'default',
})

const scenes = new Map<number, string>()
for (const [path, url] of Object.entries(files)) {
  const match = /\/(\d+)[^/]*$/.exec(path)
  if (match) scenes.set(Number(match[1]), url)
}

/** O cenário do degrau na posição `position`, contada do primeiro degrau da
 *  escala a partir de zero. Ausente quando o arquivo ainda não existe. */
export function tierScene(position: number): string | undefined {
  return scenes.get(position)
}
