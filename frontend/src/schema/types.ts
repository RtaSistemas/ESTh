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
}

export interface ColorSchemeInfo {
  name: string;
  displayName: string;
}

// Um valor de propriedade COLOR/PATH pode ser um literal ("FFFFFFFF") ou
// uma referência de variável ("${gameNameColor}"). Isso não vem tipado do
// backend (é só string) — a checagem de forma "${...}" acontece no ponto de uso.
export function resolveVariable(
  rawValue: string,
  variables: Record<string, string> | undefined
): string {
  if (!variables) return rawValue;
  const match = /^\$\{(.+)\}$/.exec(rawValue);
  if (!match) return rawValue;
  return variables[match[1]] ?? rawValue;
}
