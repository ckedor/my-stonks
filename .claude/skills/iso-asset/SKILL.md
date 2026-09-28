---
name: iso-asset
description: Modela uma peça do jogo da cidade (prédio, quarteirão, marco, vegetação) a partir de uma foto ou print de referência — NYC, Google Earth 3D, uma ilustração — e itera olhando o render até bater com a referência. Use quando pedirem para criar, copiar, recriar ou ajustar uma construção do construtor isométrico a partir de uma imagem.
argument-hint: <imagem de referência> [nome ou descrição da peça]
---

# Modelar uma peça a partir de uma referência

O que dá errado quando isto é feito às cegas: sai o *conceito* certo (um
prédio) com outra identidade — outra massa, outras cores, sem os elementos
que fazem a foto ser aquele prédio. O remédio é o mesmo de quem desenha:
inventariar antes, e olhar o render contra a foto a cada volta.

Argumentos: `$ARGUMENTS` — um caminho de imagem e/ou texto livre: qual
prédio do print, andares, nome, onde entra no menu, o que é prioridade.
Trate o texto como requisito do inventário.

**A referência.** Se veio um caminho, use-o. Se a imagem veio colada na
conversa, ela tem um arquivo de origem (a anotação `source:` da imagem):
copie-o para `ideias/<grupo>/<nome-da-peça>.png`, para a referência ficar no
repositório junto da receita, e use a cópia no `--ref`. Sem imagem nenhuma,
peça o print antes de começar — não modele de memória. Se o print tiver
vários prédios e o texto não disser qual, pergunte.

## 1. Inventário da referência — antes de qualquer código

Abra a imagem e escreva, na conversa, uma lista numerada do que faz ela ser
*aquela* construção. É contra esta lista que cada render vai ser julgado.

- **Massa:** quantos volumes, onde recuam, proporção largura : fundo : altura,
  planta (retângulo, chanfro, L, pátio, curva).
- **Medidas em metros:** conte andares (3,5 m cada; casas 3 m) e janelas por
  vão. A planta cabe em lotes de 12 m. Nunca meça pixel de foto em
  perspectiva — conte elementos.
- **Fachada de cada volume:** sistema (janela recortada, pele de vidro, faixas
  horizontais, nervuras, varandas), módulo da janela, proporção cheio/vazio,
  cor do cheio e do vidro.
- **Base:** altura do térreo/embasamento, marquise, vitrines, arcos.
- **Topo:** coroamento, casa de máquinas, jardim, antena, cúpula, letreiro.
- **Elementos de identidade:** o que alguém apontaria para reconhecer —
  terraço gramado no terço de baixo, pináculo escalonado, faixa escura,
  cantiléver. Estes não podem faltar.
- **Paleta:** rode o render uma vez (passo 3) só para pegar a paleta que ele
  extrai da foto, e escolha dela o hex de cada material. Não escolha cor de
  olho.

## 2. Onde a receita mora e com o que se desenha

- Receitas em `frontend/src/components/ui/iso/`: `reference-towers.ts`
  (escritórios), `reference-midrise.ts` (edifícios urbanos), `residential.ts`,
  `vegetation.ts`, `supertall-landmarks.ts`, `gherkin.ts`, `empire-state.ts`.
  Leia a vizinha mais parecida antes de escrever: ela mostra o vocabulário.
- Primitivas em `iso/engine.ts`: `prism`, `loft` (entre plantas diferentes),
  `mansard`, `pyramid`, `dome`, `gable`; plantas `rect`, `chamfer`, `rounded`,
  `ngon`, `inset`; fachadas `punched`, `curtain`, `ribbons`, `balconies`,
  `strips`, `storefront`, `lettering`, `glassSkin`; miúdos `clutter`, `tank`,
  `antenna`, `tree`. Alturas sempre com `floors(n)` ou `meters(m)`.
- Fachada que nenhuma função cobre: escreva uma `(f: Face) => void` como
  `officeFacade` em `reference-towers.ts` (com `pane` e `point`). É assim que
  se reproduz um ritmo específico de janela — não troque por `curtain` só
  porque é mais curto.
- Registre a receita no objeto do módulo (entra em `ISO_RECIPES` por ele) e a
  peça em `frontend/src/components/city-game/catalog.ts`, com `group` e
  `subgroup` já existentes (veja o catálogo) e rótulo em português. O preço
  sai do volume sozinho; não escreva preço.
- O estilo é o do jogo — contorno, luz e sombra do engine —, não o da foto.
  Não copie iluminação nem reflexo da foto; copie forma, ritmo e cor.

## 3. Olhar o render

Na pasta `frontend/`:

```bash
npm run iso:render -- <chaveDaReceita> --ref <imagem>
```

Grava `output/iso-render/<chave>.png` — a foto à esquerda com a paleta
extraída embaixo, a peça com régua em metros, as outras três vistas — e
imprime altura, volume, preço e paleta. **Abra o PNG e olhe.** Para detalhe:
`--band top|mid|base` amplia um terço da vista; `--rotation 1..3` troca a
vista grande. Leva ~7 s; não precisa do dev server.

## 4. Iterar

A cada volta, percorra o inventário item por item e marque ✓ ou ✗ olhando a
folha. Corrija o ✗ mais grave primeiro, nesta ordem: massa e proporção →
cores → ritmo da fachada → elementos de identidade → miúdos. Confira as
outras vistas: um recuo que só funciona de frente está errado.

Pare quando o inventário estiver todo ✓, ou depois de ~6 voltas — aí diga o
que ainda difere e por quê (limite do engine, escala do lote, etc.). Não
declare pronto com ✗ em elemento de identidade.

Não invente o que a foto não mostra; o lado escondido segue a lógica do lado
visível.

Armadilhas do engine que já custaram voltas:

- **Planta côncava** (U, L, pátio) num só `prism` ordena mal: um bloco baixo
  dentro dela aparece pintado na frente da fachada. Monte com retângulos.
- **Detalhe sobre telhado inclinado** (lucarna, janela, nervura) feito como
  sólido aparece também nas faces de trás, "flutuando". Desenhe-o como
  `skin` do `loft`: o engine só chama a pele nas faces que a câmera vê
  (exemplo: `dormer` em `woolworth.ts`).

## 5. Fechar

- `npx tsc -b --noEmit` e `npx eslint` nos arquivos tocados.
- `npx vitest run src/components/city-game src/components/ui/iso`.
- Uma peça derivada de marco real com medidas documentadas entra em
  `docs/game-landmarks.md`.
- Responda com o caminho da folha final, altura/volume/preço, o inventário
  com ✓/✗, e o que ficou diferente.
