# CLAUDE.md — ES-DE Theme Editor (ESTh)

Guia rápido para sessões do Claude Code neste repositório.

## O que é

Editor visual de temas para o ES-DE (EmulationStation Desktop Edition):
edita `pos`/`size`/`origin` e demais propriedades de elementos de tema
(`carousel`, `image`, `text`, etc.) com import/export de `theme.xml`, sem
depender do binário do ES-DE para o preview.

Ver `README.md` para o histórico de rodadas e o escopo atual (o que ainda
não está incluído).

## Comandos essenciais

```bash
# Backend (FastAPI)
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Testes do backend (parser/serializer/geometry/capabilities/variables/API)
cd backend
pip install -r requirements-dev.txt
pytest -v

# Frontend (React + Vite + TS)
cd frontend
npm install
npm run dev          # dev server, padrão http://localhost:5173
npm run build         # tsc -b && vite build
npm test              # vitest run (frontend/tests/)
```

Backend e frontend têm suíte de testes automatizada. Backend
(`backend/tests/`, pytest) cobre parser/serializer (round-trip completo),
geometry, capabilities, variables, o schema (guarda de regressão pra
`instancesPerView`) e os endpoints da API. Frontend (`frontend/tests/`,
Vitest + React Testing Library) cobre geometry.ts (mesmo invariante do
lado Python), persistence.ts, assetStorage.ts (IndexedDB, via
fake-indexeddb) e o Inspector (escolha de input por `PropType` — a regra
central do componente). `tsc -b`/`vite build` e o fluxo end-to-end via
Chromium headless seguem como validação adicional. Ver "Validado neste
scaffold" no README para o que já foi coberto.

## Arquitetura

```
theme.xml ⇄ backend (parser.py / serializer.py) ⇄ modelo interno (JSON) ⇄ frontend (canvas + inspector)
```

```
backend/app/
├── schema/es_de_elements.py   ÚNICA fonte da verdade do schema de elementos ES-DE
├── parser.py                  theme.xml -> modelo interno (JSON)
├── serializer.py               modelo interno -> theme.xml
├── geometry.py                  conversão normalizado (0..1) <-> pixel
├── capabilities.py              parse de capabilities.xml (colorSchemes)
├── variables.py                 parse de arquivo de variáveis por colorScheme
└── main.py                      rotas FastAPI (/schema, /theme/parse, /theme/serialize, ...)

frontend/src/
├── schema/types.ts             tipos espelhando o schema do backend (sincronia manual)
├── components/Canvas.tsx       canvas react-konva: seleção, drag, renderização real
├── components/Inspector.tsx    painel de propriedades DIRIGIDO PELO SCHEMA (GET /schema)
├── geometry.ts                  espelha backend/app/geometry.py no frontend
└── App.tsx                      estado do modelo, undo/redo, import/export
```

## Regras de código

- **`es_de_elements.py` é o único lugar** onde "o que é um elemento ES-DE e
  quais propriedades ele aceita" é definido. Parser, serializer e o
  Inspector do frontend leem daqui (via `GET /schema`) — nunca duplicar
  conhecimento de schema em outro arquivo.
- **Inspector não conhece tipos de elemento hardcoded** — escolhe o input
  pelo `PropType` (`NORMALIZED_PAIR`, `PATH`, `BOOLEAN`, `COLOR`,
  `UNSIGNED_INTEGER`, `FLOAT`, `STRING`). Novas propriedades/elementos
  entram editando só o schema Python; se o Inspector precisar de lógica
  especial por tag, o design quebrou.
- **Precisão geométrica**: todo `pos`/`size`/`origin` é convertido para
  pixels ancorado em `REFERENCE_RESOLUTION` (hoje 1920×1080) antes de ir
  pro canvas, e reconvertido para normalizado antes de voltar ao
  XML/modelo. Nunca fazer aritmética direta em valores normalizados
  misturando com pixels — usar sempre `geometry.py` (backend) /
  `geometry.ts` (frontend).
- **`frontend/src/schema/types.ts` é mantido manualmente em sincronia**
  com `backend/app/schema/es_de_elements.py` e o payload de `GET
  /schema` — qualquer mudança de schema no backend deve refletir aqui.
  Gerar isso automaticamente é melhoria futura, não implementada.
- Valores `COLOR`/`PATH` podem ser uma referência `${nomeDaVariavel}` —
  resolvida **apenas para exibição** no canvas (`resolveVariable` em
  `types.ts`); o modelo/XML sempre preserva a referência original, nunca
  o valor resolvido.
- Elementos são desenhados no canvas **ordenados por `zIndex`**, não pela
  ordem do array do modelo (bug já corrigido uma vez — não reintroduzir).

## Armadilhas conhecidas

- **`instancesPerView: "single"`** (elementos primários: `carousel`,
  `grid`, `textlist`) — a UI deve impedir adicionar um segundo elemento
  primário na mesma view. Isso é regra de schema, não hardcode na UI.
- **CORS no backend** está liberado só para `http://localhost:5173`
  (`main.py`) — ajustar antes de qualquer deploy além de uso local.
- **`ProcessPoolExecutor`/paralelismo**: não se aplica aqui (não há
  paralelismo no backend hoje) — não confundir com padrões de outros
  projetos do usuário.

## Escopo atual (não incluído ainda)

Ver README.md, seção "Escopo atual", para a lista completa
(`<variant>`, `<include>`, `sound`/`helpsystem`, renderização real de
carousel/grid/textlist, multi-seleção, resize por arraste, persistência
de projeto).

## Commits (Conventional Commits)

```
feat(schema): adiciona elemento <sound> ao schema
fix(canvas): corrige ordenação por zIndex ao renderizar
refactor(inspector): remove conhecimento hardcoded de tipo de elemento
docs(readme): documenta rodada 4
```

Tipos válidos: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`
