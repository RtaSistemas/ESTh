import type { ElementDef, ThemeElement } from "../schema/types";

interface InspectorProps {
  element: ThemeElement | null;
  elementDef: ElementDef | null;
  onChange: (propName: string, value: unknown) => void;
}

// Painel dinâmico: não conhece "carousel" ou "text" — só sabe ler
// PropertyDef do schema e escolher o input certo pelo `type`. Adicionar um
// elemento novo ao schema Python não exige tocar neste arquivo.
export function Inspector({ element, elementDef, onChange }: InspectorProps) {
  if (!element || !elementDef) {
    return (
      <div style={panelStyle}>
        <p style={{ color: "#888" }}>Selecione um elemento no canvas.</p>
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      <h3 style={{ margin: "0 0 4px" }}>{element.type}</h3>
      <p style={{ margin: "0 0 12px", color: "#888", fontSize: 12 }}>{element.name}</p>

      {elementDef.properties.map((propDef) => {
        const value = element.properties[propDef.name] ?? propDef.default;

        if (propDef.type === "NORMALIZED_PAIR") {
          const [x, y] = (value as [number, number]) ?? [0, 0];
          return (
            <div key={propDef.name} style={rowStyle}>
              <label style={labelStyle}>{propDef.name}</label>
              <div style={{ display: "flex", gap: 4 }}>
                <input
                  type="number"
                  step={0.001}
                  value={x}
                  onChange={(e) => onChange(propDef.name, [Number(e.target.value), y])}
                  style={inputStyle}
                />
                <input
                  type="number"
                  step={0.001}
                  value={y}
                  onChange={(e) => onChange(propDef.name, [x, Number(e.target.value)])}
                  style={inputStyle}
                />
              </div>
            </div>
          );
        }

        if (propDef.type === "FLOAT" || propDef.type === "UNSIGNED_INTEGER") {
          return (
            <div key={propDef.name} style={rowStyle}>
              <label style={labelStyle}>{propDef.name}</label>
              <input
                type="number"
                step={propDef.type === "FLOAT" ? 0.01 : 1}
                min={propDef.minValue ?? undefined}
                max={propDef.maxValue ?? undefined}
                value={value as number}
                onChange={(e) => onChange(propDef.name, Number(e.target.value))}
                style={inputStyle}
              />
            </div>
          );
        }

        if (propDef.type === "BOOLEAN") {
          return (
            <div key={propDef.name} style={rowStyle}>
              <label style={labelStyle}>{propDef.name}</label>
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => onChange(propDef.name, e.target.checked)}
              />
            </div>
          );
        }

        if (propDef.type === "STRING" && propDef.validValues) {
          return (
            <div key={propDef.name} style={rowStyle}>
              <label style={labelStyle}>{propDef.name}</label>
              <select
                value={value as string}
                onChange={(e) => onChange(propDef.name, e.target.value)}
                style={inputStyle}
              >
                {propDef.validValues.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          );
        }

        if (propDef.type === "COLOR") {
          const hex = typeof value === "string" ? value.slice(0, 6) : "FFFFFF";
          return (
            <div key={propDef.name} style={rowStyle}>
              <label style={labelStyle}>{propDef.name}</label>
              <input
                type="color"
                value={`#${hex}`}
                onChange={(e) => onChange(propDef.name, e.target.value.slice(1).toUpperCase() + "FF")}
              />
            </div>
          );
        }

        // PATH, STRING livre e demais tipos: input de texto simples
        return (
          <div key={propDef.name} style={rowStyle}>
            <label style={labelStyle}>{propDef.name}</label>
            <input
              type="text"
              value={(value as string) ?? ""}
              onChange={(e) => onChange(propDef.name, e.target.value)}
              style={inputStyle}
            />
          </div>
        );
      })}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  width: 260,
  padding: 16,
  background: "#1a1c22",
  color: "#e6e6e6",
  fontFamily: "system-ui, sans-serif",
  fontSize: 13,
  overflowY: "auto",
};

const rowStyle: React.CSSProperties = { marginBottom: 10 };
const labelStyle: React.CSSProperties = { display: "block", marginBottom: 4, color: "#aaa" };
const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0f1115",
  border: "1px solid #33363f",
  color: "#e6e6e6",
  borderRadius: 4,
  padding: "4px 6px",
  boxSizing: "border-box",
};
