import { useEffect, useState } from "react";
import { Canvas } from "./components/Canvas";
import { Inspector } from "./components/Inspector";
import { clearPersistedProject, loadPersistedProject, savePersistedProject } from "./persistence";
import type { ColorSchemeInfo, Schema, ThemeModel, ViewName } from "./schema/types";

const API_BASE = "http://localhost:8000";

// Modelo de partida: um elemento de cada tipo suportado, com valores
// tirados do exemplo do THEMES-DEV.md e do padrão de posição central do
// carrossel no Iconic — só para o editor não abrir vazio.
const SEED_MODEL: ThemeModel = {
  views: {
    system: [
      {
        type: "carousel",
        name: "systemCarousel",
        properties: {
          pos: [0, 0.38378],
          size: [1, 0.2324],
          origin: [0, 0],
          zIndex: 50,
          type: "horizontal",
          itemSize: [0.25, 0.155],
          itemScale: 1.2,
          maxItemCount: 3,
          horizontalOffset: 0,
          verticalOffset: 0,
        },
      },
    ],
    gamelist: [
      {
        type: "text",
        name: "gameName",
        properties: {
          pos: [0.27, 0.32],
          size: [0.12, 0.41],
          origin: [0.5, 0.5],
          zIndex: 40,
          text: "Super Mario World",
          fontPath: "",
          fontSize: 0.045,
          color: "${gameNameColor}",
          horizontalAlignment: "left",
          verticalAlignment: "center",
          letterCase: "none",
        },
      },
      {
        type: "image",
        name: "frame1",
        properties: {
          pos: [0.5, 0.5],
          size: [0.8, 0.8],
          origin: [0.5, 0.5],
          zIndex: 10,
          path: "./core/frame.png",
          tile: false,
          color: "FFFFFFFF",
          imageCornerRadius: 0,
        },
      },
    ],
  },
  warnings: [],
};

export default function App() {
  const [schema, setSchema] = useState<Schema | null>(null);

  // Lido uma única vez (lazy initializer) — os demais useState abaixo
  // semeiam a partir daqui em vez de sempre começar do SEED_MODEL.
  const [persisted] = useState(() => loadPersistedProject());

  // Histórico para undo/redo: pilha de snapshots do modelo + ponteiro.
  // Cada mudança efetiva (mover, editar propriedade, adicionar, remover,
  // importar) empurra um novo snapshot e descarta o "futuro" se o usuário
  // havia dado undo antes de editar de novo — comportamento padrão de editor.
  // O histórico de undo em si não é persistido, só o snapshot atual.
  const [history, setHistory] = useState<ThemeModel[]>([persisted?.model ?? SEED_MODEL]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const model = history[historyIndex];

  function applyModelChange(updater: (prev: ThemeModel) => ThemeModel) {
    setHistory((prevHistory) => {
      const next = updater(prevHistory[historyIndex]);
      const truncated = prevHistory.slice(0, historyIndex + 1);
      return [...truncated, next];
    });
    setHistoryIndex((i) => i + 1);
  }

  function undo() {
    setHistoryIndex((i) => Math.max(0, i - 1));
  }

  function redo() {
    setHistoryIndex((i) => Math.min(history.length - 1, i + 1));
  }

  const [view, setView] = useState<ViewName>(persisted?.view ?? "gamelist");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [newElementType, setNewElementType] = useState<string>("");

  const [colorSchemes, setColorSchemes] = useState<ColorSchemeInfo[]>(persisted?.colorSchemes ?? []);
  const [selectedScheme, setSelectedScheme] = useState<string>(persisted?.selectedScheme ?? "");
  // nome do esquema -> (nome da variável -> valor resolvido)
  const [variablesByScheme, setVariablesByScheme] = useState<Record<string, Record<string, string>>>(
    persisted?.variablesByScheme ?? {}
  );
  // path do asset como referenciado no XML -> objectURL local — nunca
  // persistido (objectURL morre ao recarregar), ver persistence.ts.
  const [assetMap, setAssetMap] = useState<Record<string, string>>({});

  // Autosave: qualquer mudança no projeto grava no localStorage (debounce
  // curto pra não escrever a cada tecla ao digitar um número no Inspector).
  useEffect(() => {
    const timeout = setTimeout(() => {
      savePersistedProject({ model, view, selectedScheme, colorSchemes, variablesByScheme });
    }, 400);
    return () => clearTimeout(timeout);
  }, [model, view, selectedScheme, colorSchemes, variablesByScheme]);

  function handleNewTheme() {
    const ok = window.confirm(
      "Isso descarta o tema atual (e o histórico de desfazer) e recomeça do zero. Continuar?"
    );
    if (!ok) return;
    clearPersistedProject();
    setHistory([SEED_MODEL]);
    setHistoryIndex(0);
    setSelectedIndex(null);
    setView("gamelist");
    setColorSchemes([]);
    setSelectedScheme("");
    setVariablesByScheme({});
    setAssetMap({});
  }

  useEffect(() => {
    fetch(`${API_BASE}/schema`)
      .then((r) => r.json())
      .then((s: Schema) => {
        setSchema(s);
        const firstValidType = Object.entries(s.elements).find(([, def]) =>
          def.views.includes(view)
        )?.[0];
        if (firstValidType) setNewElementType(firstValidType);
      })
      .catch(() => {
        // Backend fora do ar não deve travar o editor — só desabilita
        // import/export/validação server-side; edição visual local segue ok.
        console.warn("Não foi possível carregar /schema do backend. Rode o backend em :8000.");
      });
  }, []);

  const elements = model.views[view];
  const selectedElement = selectedIndex !== null ? elements[selectedIndex] : null;
  const selectedElementDef = selectedElement && schema ? schema.elements[selectedElement.type] : null;

  const elementTypesForView = schema
    ? Object.entries(schema.elements)
        .filter(([, def]) => def.views.includes(view))
        .map(([tag]) => tag)
    : [];

  function updateProperty(propName: string, value: unknown) {
    if (selectedIndex === null) return;
    applyModelChange((prev) => {
      const next = structuredClone(prev);
      next.views[view][selectedIndex].properties[propName] = value;
      return next;
    });
  }

  function moveElement(index: number, newPos: [number, number]) {
    applyModelChange((prev) => {
      const next = structuredClone(prev);
      next.views[view][index].properties.pos = newPos;
      return next;
    });
  }

  function addElement() {
    if (!schema || !newElementType) return;
    const elementDef = schema.elements[newElementType];
    if (!elementDef) return;

    // Elementos "single" (primários, ex. carousel/grid/textlist) só podem
    // existir uma vez por view — reforça a regra do schema na UI.
    if (elementDef.instancesPerView === "single") {
      const alreadyExists = elements.some((el) => el.type === newElementType);
      if (alreadyExists) {
        alert(`Só pode haver um elemento "${newElementType}" por view.`);
        return;
      }
    }

    const countOfType = elements.filter((el) => el.type === newElementType).length;
    const name = `${newElementType}${countOfType + 1}`;

    const properties: Record<string, unknown> = {};
    for (const propDef of elementDef.properties) {
      properties[propDef.name] =
        propDef.default ?? (propDef.name === "zIndex" ? elementDef.defaultZIndex : null);
    }

    applyModelChange((prev) => {
      const next = structuredClone(prev);
      next.views[view].push({ type: newElementType, name, properties });
      return next;
    });
    setSelectedIndex(elements.length); // seleciona o recém-criado
  }

  function deleteSelectedElement() {
    if (selectedIndex === null) return;
    applyModelChange((prev) => {
      const next = structuredClone(prev);
      next.views[view].splice(selectedIndex, 1);
      return next;
    });
    setSelectedIndex(null);
  }

  async function handleExport() {
    const res = await fetch(`${API_BASE}/theme/serialize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(model),
    });
    const xmlText = await res.text();
    const blob = new Blob([xmlText], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "theme.xml";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportCapabilities(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/capabilities/parse`, { method: "POST", body: formData });
    if (!res.ok) {
      alert("Falha ao importar capabilities.xml — veja o console.");
      console.error(await res.text());
      return;
    }
    const data: { colorSchemes: ColorSchemeInfo[] } = await res.json();
    setColorSchemes(data.colorSchemes);
    if (data.colorSchemes.length > 0 && !selectedScheme) {
      setSelectedScheme(data.colorSchemes[0].name);
    }
  }

  async function handleImportVariables(file: File, schemeName: string) {
    if (!schemeName) {
      alert("Importe o capabilities.xml primeiro e selecione uma colorScheme.");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/variables/parse?scheme_name=${encodeURIComponent(schemeName)}`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      alert("Falha ao importar variáveis — veja o console.");
      console.error(await res.text());
      return;
    }
    const data: { schemeName: string; variables: Record<string, string> } = await res.json();
    setVariablesByScheme((prev) => ({ ...prev, [data.schemeName]: data.variables }));
  }

  function handleImportAssets(files: FileList) {
    const nextMap: Record<string, string> = { ...assetMap };
    for (const file of Array.from(files)) {
      // webkitRelativePath preserva a estrutura da pasta escolhida, ex:
      // "meutema/core/frame.png" — normalizamos para bater com paths do
      // tipo "./core/frame.png" usados no XML.
      const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      const withoutRoot = relative.split("/").slice(1).join("/");
      const key = `./${withoutRoot}`;
      nextMap[key] = URL.createObjectURL(file);
    }
    setAssetMap(nextMap);
  }

  async function handleImport(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/theme/parse`, { method: "POST", body: formData });
    if (!res.ok) {
      alert("Falha ao importar o tema — veja o console.");
      console.error(await res.text());
      return;
    }
    const parsed: ThemeModel = await res.json();
    applyModelChange(() => parsed);
    setSelectedIndex(null);
  }

  return (
    <div className="app-shell">
      <div className="app-main">
        <div className="brand-bar">
          <div className="brand">
            <span className="brand-mark">ES</span>
            <span className="brand-title">Theme Editor</span>
          </div>
        </div>

        <header className="topbar">
          <div className="toolbar-group">
            <select
              className="select"
              value={view}
              onChange={(e) => {
                const nextView = e.target.value as ViewName;
                setView(nextView);
                setSelectedIndex(null);
                const firstValid = schema
                  ? Object.entries(schema.elements).find(([, def]) => def.views.includes(nextView))?.[0]
                  : undefined;
                if (firstValid) setNewElementType(firstValid);
              }}
            >
              <option value="system">system</option>
              <option value="gamelist">gamelist</option>
            </select>

            <button className="btn" onClick={undo} disabled={historyIndex === 0} title="Desfazer">
              ↶ Desfazer
            </button>
            <button className="btn" onClick={redo} disabled={historyIndex === history.length - 1} title="Refazer">
              ↷ Refazer
            </button>
            <button className="btn" onClick={handleNewTheme} title="Descarta o tema atual e recomeça do zero">
              Novo tema
            </button>
          </div>

          <span className="toolbar-divider" />

          <div className="toolbar-group">
            <select className="select" value={newElementType} onChange={(e) => setNewElementType(e.target.value)}>
              {elementTypesForView.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
            <button className="btn btn-primary" onClick={addElement} disabled={!newElementType}>
              + Adicionar elemento
            </button>
            <button className="btn btn-danger" onClick={deleteSelectedElement} disabled={!selectedElement}>
              🗑 Remover selecionado
            </button>
          </div>

          <span className="toolbar-divider" />

          <div className="toolbar-group">
            <label className="file-btn">
              Importar theme.xml
              <input
                type="file"
                accept=".xml"
                onChange={(e) => e.target.files && handleImport(e.target.files[0])}
              />
            </label>
            <button className="btn btn-primary" onClick={handleExport}>
              Exportar theme.xml
            </button>
          </div>

          <span className="toolbar-divider" />

          <div className="toolbar-group">
            <label className="file-btn">
              Importar capabilities.xml
              <input
                type="file"
                accept=".xml"
                onChange={(e) => e.target.files && handleImportCapabilities(e.target.files[0])}
              />
            </label>

            {colorSchemes.length > 0 && (
              <>
                <select className="select" value={selectedScheme} onChange={(e) => setSelectedScheme(e.target.value)}>
                  {colorSchemes.map((cs) => (
                    <option key={cs.name} value={cs.name}>
                      {cs.displayName}
                    </option>
                  ))}
                </select>
                <label className="file-btn">
                  Importar variáveis
                  <input
                    type="file"
                    accept=".xml"
                    onChange={(e) => e.target.files && handleImportVariables(e.target.files[0], selectedScheme)}
                  />
                </label>
                <span className="scheme-pill">{selectedScheme}</span>
              </>
            )}
          </div>

          <span className="toolbar-spacer" />

          <label className="file-btn">
            Importar pasta de assets
            <input
              type="file"
              // @ts-expect-error webkitdirectory não está no lib.dom.d.ts
              webkitdirectory=""
              onChange={(e) => e.target.files && handleImportAssets(e.target.files)}
            />
          </label>
        </header>

        <div className="viewport">
          {schema ? (
            <Canvas
              elements={elements}
              view={view}
              reference={schema.referenceResolution}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
              onMove={moveElement}
              assetMap={assetMap}
              variables={variablesByScheme[selectedScheme]}
            />
          ) : (
            <p className="viewport-loading">Carregando schema do backend...</p>
          )}
        </div>
      </div>

      <Inspector element={selectedElement} elementDef={selectedElementDef} onChange={updateProperty} />
    </div>
  );
}
