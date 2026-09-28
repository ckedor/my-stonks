# Arranha-céus: escala dos edifícios de referência

Modelos em `frontend/src/components/ui/iso/supertall-landmarks.ts`, disponíveis
em **Prédios › Arranha-céus** no catálogo compartilhado pelo sandbox. Os identificadores antigos
do Burj Khalifa (`spiral-tower`) e do One World Trade Center (`faceted-tower`)
foram preservados para as peças já colocadas.

## Alturas e volumes

A régua existente usa 12 m por tile. As alturas são passadas em metros ao motor,
sem arredondamento para pavimentos. A projeção isométrica altera a aparência da
profundidade na tela, mas não as medidas em planta.

| Ativo | Altura até o topo | Lote do asset | Volume aproximado da geometria principal |
| --- | ---: | ---: | ---: |
| Central Park Tower | 472,44 m (1.550 pés) | 5 × 5 tiles | 632 mil m³ |
| Taipei 101 | 508 m | 6 × 6 tiles | 1,105 milhão m³ |
| Burj Khalifa | 828 m | 10 × 10 tiles | 949 mil m³ |
| One World Trade Center | 541,3248 m (1.776 pés) | 6 × 6 tiles | 1,382 milhão m³ |

`LANDMARK_DIMENSIONS` expõe altura e volume em unidades físicas para consulta
posterior. O cálculo usa as mesmas plantas e cotas que desenham os modelos.
São **estimativas do envelope exterior modelado**, não volumes reais certificados,
quantidade de concreto, área construída ou área vendável. Não usar o lote inteiro
multiplicado pela altura: ele inclui espaços vazios ao redor e entre as alas.

A área de cada polígono é calculada pela fórmula do cadarço, convertida de tiles²
para m². Entre duas plantas interpoladas linearmente, o volume é
`altura × (área inferior + 4 × área intermediária + área superior) / 6`.
Somam-se segmentos em faixas de altura disjuntas, sem contar duas vezes os corpos.
Excluem-se subsolos, paisagismo, aletas, cornijas delgadas, anéis de comunicação
e antenas finas; os corpos maiores das agulhas do Burj e do Taipei são incluídos.
O shopping anexo do Taipei e os edifícios baixos do complexo do Burj não fazem
parte destes assets. As alturas são verificadas; as plantas intermediárias e
cotas dos recuos são aproximações visuais, portanto os volumes dependem delas.

## Características reproduzidas e referências

- **Central Park Tower:** vidro grafite com reflexo violeta atrás de frisos
  verticais cinza de aço ("pinstripes"), bordas claras nos recuos (paleta
  escolhida pelo mantenedor a partir de uma ilustração isométrica), cantiléver
  de 8,4 m a leste a partir de
  88 m, recuos assimétricos nos cantos e coroamento técnico sem antena.
  Embasamento aproximado de 56,4 × 56,4 m; corpo inferior de 29,4 × 36 m,
  37,8 × 39 m com o cantiléver, reduzindo até 27,6 × 28,2 m. A planta exata
  não foi encontrada publicada; as larguras são aproximações visuais.
  [Wikipedia: cantiléver de 28 pés a ~88 m, fachada e frisos](https://en.wikipedia.org/wiki/Central_Park_Tower),
  [Empreendimento oficial](https://centralparktower.com/tower),
  [CVU/Skyscraper Center: altura e fotografia](https://www.skyscrapercenter.com/building/central-park-tower/14269),
  [Permasteelisa: imagens e fachada](https://www.permasteelisagroup.com/project/central-park-tower/).
- **Taipei 101:** oito módulos de vidro verde que se alargam para cima,
  bordas claras, pequenos suportes nos cantos, medalhões e agulha escalonada.
  Base aproximada de 60 × 60 m; módulos de 48 × 48 m a 55,2 × 55,2 m.
  [CVU/Skyscraper Center: 508 m, imagens e pavimento ocupado a 438 m](https://www.skyscrapercenter.com/building/taipei-101/117),
  [fotografia de referência](https://commons.wikimedia.org/wiki/File:Tower_of_Taipei_101.jpg).
- **Burj Khalifa:** planta em Y com extremidades arredondadas, recuos alternados
  nas três alas, vidro azulado, nervuras prateadas e agulha telescópica.
  Alcances iniciais das alas, desde o centro, de aproximadamente 54,6 / 49,2 /
  44,4 m; largura inicial de 23,52 m. O terreno de 120 × 120 m não é a área
  construída da torre. Todas as cotas aumentam até os 828 m, evitando segmentos
  de altura negativa na transição para a agulha.
  [SOM: altura, planta em Y, recuos e fotografias](https://www.som.com/projects/burj-khalifa/).
- **One World Trade Center:** base de 60,96 × 60,96 m, oito faces triangulares,
  cobertura em quadrado de 45,72 m de lado girado 45°, anéis abertos e mastro
  segmentado. Corpo principal até aproximadamente 417 m; a altura total inclui
  a agulha. A malha de vidro mantém montantes paralelos nas faces triangulares.
  [SOM: altura de 1.776 pés, geometria, cobertura de 150 pés e fotografias](https://www.som.com/projects/one-world-trade-center/).

Referências consultadas em 26/09/2026. Fotografias usadas para interpretação
visual; os assets são desenhos procedurais próprios, sem incorporar as fotos.

## Woolworth Building

Modelo único em `iso/woolworth.ts`, em **Prédios › Arranha-céus**, com o nome
**Woolworth Building**. O modelo antigo foi substituído pela versão escolhida
pelo usuário. O id `woolworth-building-codex` permanece como alias oculto para
peças já salvas, desenhando o mesmo modelo que `woolworth-building`.
Altura arquitetônica de **241,4 m**
([CTBUH](https://www.skyscrapercenter.com/building/woolworth-building/969)),
na régua comum de 12 m por célula. Corpo de aproximadamente 60,3 × 46,3 m,
lote de 6 × 4 células, torre inferior de 26,2 × 25,6 m.
As cotas intermediárias (108, 169, 190,8 e 208 m) e a ornamentação são
interpretação visual. Base em U, recuos, estágio octogonal, janelas pareadas,
cobre com juntas e lucarnas, pináculos e lanterna. A revisão 9 do layout
recolhe para “A colocar” os exemplares que não couberem após a troca.
