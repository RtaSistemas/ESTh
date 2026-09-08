# ES-DE Theme Editor — item 1 (editor)

Esboço inicial. Escopo: editar visualmente `pos`/`size`/`origin` de
elementos de tema ES-DE (carousel, image, text) com import/export de
`theme.xml`, sem depender do binário do ES-DE para o preview (preview
aproximado, conforme decidido).

## Arquitetura

```
theme.xml  ⇄  backend (parser.py / serializer.py)  ⇄  modelo interno (JSON)  ⇄  frontend (canvas + inspector)
```

- **backend/** — Python + FastAPI. Fonte da verdade do schema
  (`app/schema/es_de_elements.py`, baseado no `THEMES-DEV.md` do ES-DE e no
  tema Iconic como referência). Contém parser (XML → modelo), serializer
  (modelo → XML) e `geometry.py`, que aplica o mesmo princípio de precisão
  geométrica usado no Box3D (conversão normalizado↔pixel ancorada em uma
  resolução de referência, hoje Full HD / 16:9).
- **frontend/** — React + Vite + TypeScript + `react-konva` para o canvas
  interativo (seleção, drag). O Inspector de propriedades é **dirigido pelo
  schema** vindo de `GET /schema` — não tem conhecimento hardcoded de
  "carousel" ou "text", só sabe ler `PropertyDef` e escolher o input certo
  pelo tipo. Isso é a "estrutura dinâmica" combinada: novos elementos ou
  propriedades entram editando só o schema Python.

## Rodada 2 — renderização real + colorScheme

- **Canvas renderiza conteúdo real**: `image` carrega o PNG/JPG de fato
  (via `KonvaImage`); `text` desenha o texto real com fonte/alinhamento.
  Falha ao resolver o asset (path não encontrado no mapa importado) cai de
  volta pro placeholder colorido — nunca quebra o preview.
- **`capabilities.xml`**: `POST /capabilities/parse` extrai as
  `<colorScheme>` declaradas. O frontend popula um seletor no header.
- **Variáveis por colorScheme**: `POST /variables/parse` lê um arquivo de
  variáveis (padrão usado pelo Iconic: um arquivo por esquema) e devolve o
  dict nome→valor. Propriedades `COLOR`/`PATH` cujo valor é uma referência
  `${nomeDaVariavel}` são resolvidas **apenas para exibição** no canvas — o
  modelo/XML mantém a referência intacta, preservando a autoria do tema.
- **Importação de pasta de assets**: input com `webkitdirectory` monta um
  mapa `path do XML → objectURL local`, usado para resolver `image.path`.
- **Bug corrigido nesta rodada**: o canvas desenhava na ordem do array do
  modelo, ignorando `zIndex` — elementos com zIndex maior podiam ficar
  escondidos atrás de elementos com zIndex menor. Corrigido: os elementos
  são ordenados por `zIndex` antes de desenhar.

Validado com asset PNG sintético + `capabilities.xml`/variables de teste:
imagem real substituiu o placeholder e a cor do texto mudou de cinza
(variável não resolvida) para o valor real da colorScheme importada.

## Rodada 3 — expansão de escopo (mais elementos, add/delete, undo/redo)

- **7 novos elementos no schema**: `grid`, `textlist` (primários), `video`,
  `badges`, `rating`, `datetime`, `gamelistinfo` (secundários) — total de
  10 elementos suportados. Ver nota de precisão no topo de
  `es_de_elements.py`: `carousel`/`image`/`text` foram cruzados contra o
  THEMES-DEV.md; os 7 novos seguem o mesmo padrão estrutural mas são um
  subconjunto de melhor esforço, vale revalidar antes de expandir mais.
- **Adicionar/remover elemento pela UI**: antes só dava para editar o que
  vinha de um `theme.xml` importado — agora dá para criar um tema do zero.
  O tipo de elemento oferecido já é filtrado pela `view` atual e a regra de
  "só um elemento primário por view" (schema `instancesPerView: single`) é
  reforçada na UI.
- **Undo/redo**: pilha de snapshots do modelo com ponteiro; qualquer
  mudança efetiva (mover, editar propriedade, adicionar, remover, importar)
  empilha um novo snapshot.
- **Bug corrigido**: rótulo de identificação (`tipo:nome`) se misturava
  visualmente com o conteúdo real desenhado por baixo. Agora tem uma barra
  de fundo sólido semi-transparente.
- **Bug corrigido**: botão "Remover selecionado" ficava habilitado mesmo
  sem seleção válida depois de um undo (índice ficava "órfão" apontando
  para fora do array). Corrigido: o estado do botão agora depende do
  elemento resolvido, não do índice bruto.

Validado de ponta a ponta via Chromium headless: schema com 10 elementos
confirmado no `/schema`, adicionar elemento → aparece selecionado com
valores default do schema → desfazer remove → refazer restaura.

## Rodada 4 — reforma visual, preview estático, persistência, resize, testes

- **Design system em CSS** (`frontend/src/styles.css`): toolbar/botões/
  inputs consistentes no lugar de estilo inline ad-hoc, viewport com fundo
  quadriculado, rótulos de elemento como tags flutuantes acima da caixa
  (antes cobriam o conteúdo real desenhado por baixo).
- **Esquema de cores por papel**: header/toolbar/sidebar do app usam papéis
  ($surface/$primary/$primary-darken-2/$panel) com hex validados por
  contraste contra cada fundo; a paleta categórica do canvas (itens de
  carousel/grid, placeholders de elemento) foi reduzida a só os tons que
  passam num piso de contraste de 3:1 contra `--bg-canvas`, sem cores
  arbitrárias.
- **Preview estático de `carousel`/`grid`/`textlist`**: em vez do
  retângulo placeholder único, calcula e desenha itens de exemplo a
  partir de `itemSize`/`itemScale`/`itemSpacing`/`rows`/`columns`/
  `maxItemCount` — só posição/exibição, sem navegação ou item-ativo real.
- **Persistência de projeto** (`frontend/src/persistence.ts`): modelo,
  view, colorScheme selecionada e variáveis salvam no `localStorage`
  (debounce de 400ms) e restauram ao recarregar a página. Botão "Novo
  tema" descarta o projeto salvo (e os assets, ver abaixo).
- **Resize por arraste**: 4 handles nos cantos do elemento selecionado,
  com feedback visual ao vivo durante o arraste (`geometry.ts` ganhou
  `boxToPosAndSize`, inverso de `resolveElementBox` quando pos e size
  mudam juntos).
- **Suíte de testes no backend** (`backend/tests/`, pytest): parser,
  serializer (com round-trip completo), geometry, capabilities,
  variables, schema e os endpoints da API — 35 testes.
- **Multi-seleção**: shift-clique adiciona/remove elemento da seleção;
  arrastar qualquer um dos selecionados move o grupo inteiro preservando
  a posição relativa entre eles; botões de alinhar (esquerda/topo/centro
  horizontal/centro vertical) na toolbar quando >= 2 selecionados;
  remover selecionados apaga todos de uma vez. Handles de resize
  continuam só para seleção única.
- **Preview estático dos elementos secundários restantes**: `video`
  mostra o poster (`defaultImagePath`) se resolvido, com um ícone de
  play decorativo por cima; `rating` desenha 5 estrelas reais (Konva
  `Star`) tingidas por `color`, preenchidas até uma nota de exemplo;
  `badges` distribui quadrados de exemplo conforme `direction`/
  `itemsPerRow`/`itemMargin`; `datetime`/`gamelistinfo` mostram texto
  real (cor/fonte/alinhamento) com um valor de exemplo fixo —
  `datetime` não interpreta o `format` (estilo strftime) de verdade.
- **Persistência de assets** (`frontend/src/assetStorage.ts`): os
  arquivos importados via pasta agora são salvos num IndexedDB (por
  path) e recarregados ao abrir a página — antes só o modelo persistia,
  e imagens caíam pro placeholder após um reload mesmo com o `path`
  intacto.

## Escopo atual (o que NÃO está incluído ainda)

Deixado para expansão de escopo futura:
- `<variant>`, `<aspectRatio>`, `<fontSize>`, `<language>`, `<transitions>`
- `<include>` (arquivos de tema divididos)
- `sound`, `helpsystem`
- Item ativo/navegação real em `carousel`/`grid`/`textlist` — a rodada 4
  adicionou um preview estático dos itens (posição/exibição calculada a
  partir do schema), mas não simula qual item está selecionado nem
  transições.
- Resize por arraste de um grupo multi-selecionado (só funciona com 1
  elemento selecionado por vez)

## Rodando localmente

Backend:
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# testes (opcional)
pip install -r requirements-dev.txt
pytest -v
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```

Abra o endereço que o Vite indicar (padrão `http://localhost:5173`). O
editor carrega um modelo de exemplo (seed) mesmo sem importar um XML, para
não abrir vazio.

## Validado neste scaffold

- Suíte automatizada no backend (`pytest`, `backend/tests/`): round-trip
  parser → serializer, geometry, capabilities, variables, schema e os
  endpoints da API — 35 testes.
- Suíte automatizada no frontend (`vitest`, `frontend/tests/`): geometry.ts
  (mesmo invariante de round-trip do lado Python), persistence.ts,
  assetStorage.ts (IndexedDB) e o Inspector (React Testing Library,
  cobrindo a escolha de input por `PropType` e o badge por `group`) — 32
  testes.
- `npx tsc -b` e `npx vite build` sem erros.
- Fluxo end-to-end frontend↔backend com os dois processos no ar,
  confirmado via Chromium headless (screenshots, seleção, edição de
  propriedade, resize por arraste, reload com persistência).

Não testado ainda: nenhum teste cobre o fluxo real de import de um
theme.xml de um tema publicado de verdade (só o exemplo do
THEMES-DEV.md); Canvas.tsx (react-konva) não tem teste automatizado —
precisaria mockar canvas em jsdom, deixado de fora por ora.
