import { AppPieChart, AppText } from '@/components/ui'

/* Uma alocação por categoria, em pizza.
 *
 * Existe para as duas pizzas do rebalanceamento serem a mesma pizza: lado a
 * lado, "hoje" e "depois" só se comparam se a fatia da mesma categoria tiver
 * o mesmo tamanho de referência, a mesma cor e a mesma ordem. Por isso a
 * ordem vem de quem chama — as duas recebem as categorias na mesma sequência
 * — e a cor vem do dado, que é a mesma que a pizza do Resumo desenha.
 *
 * É aqui que a cor da categoria vive nesta tela. Na tabela ela competia com
 * o verde e o vermelho do sinal; numa pizza ela identifica uma fatia, que é
 * o único trabalho que cor tem no app. */

const HEIGHT = 260

export interface AllocationSlice {
  label: string
  value: number
  color: string
}

export interface AllocationPieProps {
  slices: AllocationSlice[]
}

export default function AllocationPie({ slices }: AllocationPieProps) {
  /* Fatia de valor zero não desenha nada e ainda empurra um rótulo solto
     para a borda do gráfico. */
  const drawable = slices.filter((slice) => slice.value > 0)

  if (drawable.length === 0) {
    return <AppText tone="secondary">Sem posição para desenhar.</AppText>
  }

  return (
    <AppPieChart
      data={drawable.map((slice) => ({ label: slice.label, value: slice.value }))}
      colors={drawable.map((slice) => slice.color)}
      height={HEIGHT}
      isCurrency
      minOuterLabelPercentage={4}
    />
  )
}
