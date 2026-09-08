// Tipos do modelo interno, espelhando backend/app/schema/es_de_elements.py
// e o payload de GET /schema. Mantidos em sincronia manualmente por ora;
// gerar isso automaticamente do backend é candidato a melhoria futura.

export type PropType =
  | "NORMALIZED_PAIR"
  | "PATH"
  | "BOOLEAN"
  | "COLOR"
  | "UNSIGNED_INTEGER"
  | "FLOAT"
  | "STRING";

export interface PropertyDef {
  name: string;
  type: PropType;
  default: unknown;
  minValue: number | null;
  maxValue: number | null;
  validValues: string[] | null;
  onlyWhen: string | null;
}

export interface ElementDef {
  group: "primary" | "secondary";
  views: ("system" | "gamelist")[];
  instancesPerView: "single" | "multiple";
  defaultZIndex: number;
  properties: PropertyDef[];
}

export interface Schema {
  referenceResolution: [number, number];
  elements: Record<string, ElementDef>;
}

export interface ThemeElement {
  type: string;
  name: string;
  properties: Record<string, unknown>;
}

export type ViewName = "system" | "gamelist";

export interface ThemeModel {
  views: Record<ViewName, ThemeElement[]>;
  warnings: string[];
  // Variáveis globais do tema (bloco <variables> direto sob <theme>),
  // independentes de colorScheme — ex: paths de fonte, spacerImage.
  // Mescladas com as variáveis específicas do colorScheme selecionado
  // (variablesByScheme) antes de resolver COLOR/PATH pro canvas.
  variables: Record<string, string>;
}

export interface ColorSchemeInfo {
  name: string;
  displayName: string;
}

// Um valor de propriedade COLOR/PATH pode ser um literal ("FFFFFFFF"), uma
// referência de variável inteira ("${gameNameColor}") ou uma variável
// embutida no meio de uma string maior ("./_inc/images/${bgGradient}") —
// achado testando com o theme.xml real do Iconic. Substitui toda ocorrência
// de "${nome}" encontrada; o que não tiver variável correspondente fica
// como está (referência não resolvida, não um erro).
export function resolveVariable(
  rawValue: string,
  variables: Record<string, string> | undefined
): string {
  if (!variables) return rawValue;
  return rawValue.replace(/\$\{([^}]+)\}/g, (whole, name) => variables[name] ?? whole);
}
