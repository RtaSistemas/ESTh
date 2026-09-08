// Persistência local do projeto em edição (localStorage) — sem isso,
// fechar a aba ou dar F5 perdia o tema inteiro, já que todo o estado
// vivia só em memória do React.
//
// Assets (arquivos de imagem importados via pasta) não entram aqui —
// localStorage não aceita binário nem tem espaço pra isso — mas são
// persistidos à parte via IndexedDB (assetStorage.ts). Se por algum
// motivo o IndexedDB falhar/estiver indisponível, `path` de imagem cai
// no placeholder até reimportar a pasta — mesmo comportamento que já
// existe hoje para um path não resolvido.

import type { ColorSchemeInfo, ThemeModel, ViewName } from "./schema/types";

const STORAGE_KEY = "esth:project:v1";

export interface PersistedProject {
  model: ThemeModel;
  view: ViewName;
  selectedScheme: string;
  colorSchemes: ColorSchemeInfo[];
  variablesByScheme: Record<string, Record<string, string>>;
}

function isThemeModel(value: unknown): value is ThemeModel {
  return (
    !!value &&
    typeof value === "object" &&
    "views" in value &&
    !!(value as ThemeModel).views &&
    typeof (value as ThemeModel).views === "object"
  );
}

export function loadPersistedProject(): PersistedProject | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !isThemeModel(parsed.model)) return null;
    return parsed as PersistedProject;
  } catch {
    // JSON corrompido, localStorage indisponível (modo privado em alguns
    // navegadores), etc. — restaurar é best-effort, nunca deve quebrar o
    // editor: cai no seed normal.
    return null;
  }
}

export function savePersistedProject(project: PersistedProject): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch {
    // Cota estourada ou localStorage indisponível — autosave é
    // best-effort, silenciosamente ignorado.
  }
}

export function clearPersistedProject(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // idem
  }
}
