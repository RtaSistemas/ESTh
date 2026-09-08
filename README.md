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
  operam sobre a caixa delimitadora de todos os selecionados — cada
  elemento escala proporcionalmente à sua posição/tamanho relativos
  dentro do grupo (1 elemento é só um grupo com fração 100%, sem caso
  especial), tudo num único snapshot de undo.
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
- **Resize de grupo multi-selecionado**: os handles de canto agora
  funcionam com qualquer número de elementos selecionados, escalando
  cada um proporcionalmente à caixa delimitadora do grupo.
- **11º elemento: `helpsystem`** — validado contra um clone real do tema
  Iconic (CC0, github.com/Siddy212/iconic-es-de). Ao contrário de todo
  outro elemento, não tem `size` nem `zIndex` no ES-DE real; tem
  variantes "dimmed" de pos/origin. `sound` ficou de fora de propósito:
  só existe sob `<view name="all">`, que o modelo interno não
  representa, e não tem posição visual nenhuma (só `path`) — não se
  encaixa no schema atual.
- **Robustez do parser**: testar com o tema Iconic real expôs um
  `ValueError` não tratado (viraria 500 na API) ao encontrar um valor
  numérico com variável embutida no meio do token (ex.
  `0.478${systemNamePos}`, um recurso de variável por dimensão de
  fontSize que não implementamos). Agora vira `ThemeParseError` limpo
  (422) — não passou a suportar a variável, só parou de quebrar sem
  controle. O arquivo real completo do Iconic ainda não importa de
  ponta a ponta por causa disso; um excerto real (helpsystem + images)
  virou fixture de teste em `backend/tests/test_parser.py`.
- **`<label>` vs `<displayName>` em capabilities.xml**: o capabilities.xml
  real do Iconic (15 colorSchemes) usa `<label>`; nosso parser só lia
  `<displayName>`, então todo colorScheme caía no fallback (nome cru em
  vez do rótulo legível). Corrigido pra aceitar os dois (`label` primeiro).

## Cobertura validada contra o tema Iconic (CC0, real)

Baixei um clone do tema pra validar com dado de produção real, não só
XML sintético. Resumo do que funciona e do que não, com o motivo:

**Funciona:**
- Parsear a view compartilhada `system,gamelist` de um arquivo de aspect
  ratio direto (ex. `aspect-ratio-16-9-detailed.xml`): `helpsystem` +
  `image`s no nível raiz do arquivo.
- Resolver e renderizar assets reais do tema — PNG e **SVG** (nunca
  testado antes, só PNG sintético) — via a pasta de assets importada,
  com `path` literal apontando pro arquivo real.
- `capabilities.xml` real (15 colorSchemes, `<label>`) — nomes e rótulos
  corretos após a correção acima.

**Não funciona, e por quê (não é bug pequeno, é escopo não implementado):**
- **Nenhuma das 11 variantes de gamelist** (Textlist, Carousel, Grid:
  Boxart, etc.) nem as 8 variações de aspect ratio como opções dentro do
  app — cada aspect ratio é um arquivo `.xml` separado no tema real (sem
  suporte a trocar em runtime), e as variantes de gamelist vivem dentro
  de blocos `<variant>` que o parser não vê (só lê `<view>` filho direto
  de `<theme>`, e a maioria dos elementos com posição+asset completos no
  tema real está dentro de algum `<variant>`).
- ~~`colors.xml` do Iconic não é compatível com `variables.py`~~ —
  **corrigido na Rodada 5**: `variables.py` agora entende o formato real
  (múltiplos `<colorScheme name="a,b,c">` com `<variables>` aninhado),
  casando `scheme_name` contra a lista separada por vírgula.
- **fontSize (`small`/`medium`/`large`/`x-large`)** como dimensão de
  variável (`<fontSize name="small"><variables>...) não é lida — é o que
  causa o achado de robustez acima.

## Rodada 5 — teste de composição completa + defaults reais + variáveis

Rodada disparada por um teste de composição completa: abrir o `theme.xml`
real do Iconic (não um excerto) inteiro pela UI, com a pasta `_inc/images`
real (86 arquivos) importada como assets, e ver honestamente o que
renderiza — sem curar o resultado.

**Resultado ANTES desta rodada:** falha de composição. O canvas virava
essencialmente um retângulo uniforme (uma única cor de fallback em
~1640/1600 pontos amostrados, 12 cores distintas no total) porque:
1. 8 dos 9 elementos por view não tinham `pos`/`size` no XML, e o editor
   não tinha default nenhum por tipo de elemento — todo mundo caía no
   mesmo fallback `[0,0]`/`[0.2, 0.1]` hardcoded no Canvas, empilhados uns
   sobre os outros, indistinguíveis.
2. Praticamente todo `path`/`color` do tema real é uma variável
   (`${spacerImage}`, `${backgroundArtPath}`...) e o editor não tinha
   nenhuma variável carregada nesse fluxo de import, então tudo caía no
   placeholder genérico mesmo com os assets reais disponíveis.
3. `clock`/`systemstatus` (2 dos 9 elementos por view) nem existiam no
   schema — descartados com aviso "elemento ainda não suportado".

**Correções feitas, uma por uma:**
- **Defaults reais por elemento**, conferidos um a um contra o
  `THEMES.md` oficial (baixado direto do gitlab.com/es-de/emulationstation-de,
  não por memória): `carousel`/`grid`/`textlist` cada um com seu
  `pos`/`size`/`origin` documentado (não uma caixa genérica
  compartilhada); `badges`/`rating` com `size` mas sem `pos`; `helpsystem`
  corrigido (valores antigos eram estimados, não conferidos — inclusive
  `instancesPerView` estava errado como `single`, a doc real diz
  `unlimited`); `zIndex` de `rating`/`gamelistinfo` corrigido pra `45`
  (estava `35`/`40`). Elementos sem NENHUM default real no ES-DE
  (`image`, `video`, `text`, `datetime`, `gamelistinfo`) ficam
  honestamente sem default nenhum — não é lacuna, é o que o ES-DE real
  também exige (valor viria de um `<include>`/`<aspectRatio>`).
- **`clock` e `systemstatus`** adicionados ao schema (elementos especiais,
  sem `zIndex` próprio, sempre desenham por cima — iguais a `helpsystem`
  nesse aspecto), com defaults reais da doc.
- **Resolução de variáveis** ganhou dois caminhos que faltavam:
  `<variables>` direto sob `<theme>` (variáveis globais do tema, ex:
  `spacerImage`, fontes) agora é parseado e mesclado com as variáveis da
  colorScheme selecionada; `variables.py` agora entende o formato real do
  `colors.xml` do Iconic (múltiplos `<colorScheme name="a,b,c">` com
  `<variables>` aninhado), não só "um arquivo por esquema"; e
  `resolveVariable` no frontend agora resolve variável embutida no meio
  de uma string maior (`./_inc/images/${bgGradient}`), não só a string
  inteira.
- **Honestidade visual**: elemento sem `pos` real nenhum (nem do XML, nem
  de default do schema) não finge mais uma posição — fica escalonado por
  índice com contorno tracejado sempre visível e rótulo com "· sem pos
  real", pra nunca ser confundido com a posição real do tema.
- **Parser mais resiliente**: uma propriedade com valor não interpretável
  (ex.: `<height>${systemClockSize}</height>` do `clock` real — variável
  embutida num FLOAT) derrubava a importação do **arquivo inteiro** com
  422. Agora vira aviso por propriedade e o resto do arquivo continua
  sendo parseado — achado testando com o `theme.xml` real completo, que
  só é grande o bastante pra bater nesse caso.

**Resultado DEPOIS, mesmo teste, mesmos arquivos reais:** 56 cores
distintas amostradas (vs. 12 antes), zero erros 422, o `carousel` da
`system` view renderiza na posição/tamanho real do ES-DE com os itens de
preview dentro dela, e o `spacerImage` (`space.png`, um PNG branco 16x16
real do tema) resolve e renderiza de verdade como asset — não é mais um
placeholder. Ainda não é uma composição perfeita (a maioria dos elementos
segue sem `<include>`/`<aspectRatio>`, então vários ficam na área
escalonada "sem pos real"), mas deixou de ser uma falha de composição:
dá pra distinguir e editar cada elemento, e o que tem posição real do
ES-DE aparece na posição real.

## Escopo atual (o que NÃO está incluído ainda)

Deixado para expansão de escopo futura:
- `<variant>`, `<aspectRatio>`, `<fontSize>`, `<language>`, `<transitions>`
  — confirmado que o tema Iconic real usa os quatro primeiros
  pesadamente (ver seção acima)
- `<include>` (arquivos de tema divididos)
- `sound` (só existe sob `<view name="all">`, fora do modelo atual)
- Item ativo/navegação real em `carousel`/`grid`/`textlist` — a rodada 4
  adicionou um preview estático dos itens (posição/exibição calculada a
  partir do schema), mas não simula qual item está selecionado nem
  transições.

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
  parser → serializer, geometry, capabilities, variables (incl. formato
  multi-colorScheme real), schema (defaults reais conferidos contra o
  THEMES.md) e os endpoints da API — 56 testes.
- Suíte automatizada no frontend (`vitest`, `frontend/tests/`): geometry.ts
  (mesmo invariante de round-trip do lado Python), persistence.ts,
  assetStorage.ts (IndexedDB), resolveVariable (incl. variável embutida)
  e o Inspector (React Testing Library, cobrindo a escolha de input por
  `PropType` e o badge por `group`) — 35 testes.
- `npx tsc -b` e `npx vite build` sem erros.
- Fluxo end-to-end frontend↔backend com os dois processos no ar,
  confirmado via Chromium headless (screenshots, seleção, edição de
  propriedade, resize por arraste, reload com persistência).

Não testado ainda: nenhum teste cobre o fluxo real de import de um
theme.xml de um tema publicado de verdade (só o exemplo do
THEMES-DEV.md); Canvas.tsx (react-konva) não tem teste automatizado —
precisaria mockar canvas em jsdom, deixado de fora por ora.
