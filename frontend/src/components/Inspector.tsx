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
      <div className="inspector">
        <div className="inspector-empty">Selecione um elemento no canvas.</div>
      </div>
    );
  }

  return (
    <div className="inspector">
      <div className="inspector-header">
        <p className="inspector-eyebrow">Propriedades</p>
        <div className="inspector-type-row">
          {/* Cor do badge vem do grupo do schema (primary/secondary), não
              do nome da tag — instancesPerView já vem do mesmo campo. */}
          <span
            className="type-badge"
            style={
              {
                "--type-badge-color":
                  elementDef.group === "primary"
                    ? "var(--badge-primary-group)"
                    : "var(--badge-secondary-group)",
              } as React.CSSProperties
            }
          >
            {element.type}
          </span>
        </div>
        <p className="inspector-name">{element.name}</p>
      </div>

      <div className="inspector-body">
        {elementDef.properties.map((propDef) => {
          const value = element.properties[propDef.name] ?? propDef.default;

          if (propDef.type === "NORMALIZED_PAIR") {
            const [x, y] = (value as [number, number]) ?? [0, 0];
            return (
              <div key={propDef.name} className="prop-row">
                <label className="prop-label">{propDef.name}</label>
                <div className="prop-pair">
                  <div className="axis-field">
                    <span className="axis-tag">X</span>
                    <input
                      type="number"
                      step={0.001}
                      value={x}
                      onChange={(e) => onChange(propDef.name, [Number(e.target.value), y])}
                    />
                  </div>
                  <div className="axis-field">
                    <span className="axis-tag">Y</span>
                    <input
                      type="number"
                      step={0.001}
                      value={y}
                      onChange={(e) => onChange(propDef.name, [x, Number(e.target.value)])}
                    />
                  </div>
                </div>
              </div>
            );
          }

          if (propDef.type === "FLOAT" || propDef.type === "UNSIGNED_INTEGER") {
            return (
              <div key={propDef.name} className="prop-row">
                <label className="prop-label">{propDef.name}</label>
                <input
                  className="number-input"
                  type="number"
                  step={propDef.type === "FLOAT" ? 0.01 : 1}
                  min={propDef.minValue ?? undefined}
                  max={propDef.maxValue ?? undefined}
                  value={value as number}
                  onChange={(e) => onChange(propDef.name, Number(e.target.value))}
                />
              </div>
            );
          }

          if (propDef.type === "BOOLEAN") {
            return (
              <div key={propDef.name} className="prop-row">
                <label className="prop-label">{propDef.name}</label>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(e) => onChange(propDef.name, e.target.checked)}
                  />
                  <span className="switch-track" />
                  <span className="switch-thumb" />
                </label>
              </div>
            );
          }

          if (propDef.type === "STRING" && propDef.validValues) {
            return (
              <div key={propDef.name} className="prop-row">
                <label className="prop-label">{propDef.name}</label>
                <select
                  className="select-input"
                  value={value as string}
                  onChange={(e) => onChange(propDef.name, e.target.value)}
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
              <div key={propDef.name} className="prop-row">
                <label className="prop-label">{propDef.name}</label>
                <div className="color-field">
                  <input
                    type="color"
                    value={`#${hex}`}
                    onChange={(e) => onChange(propDef.name, e.target.value.slice(1).toUpperCase() + "FF")}
                  />
                  <span className="color-field-hex">#{(value as string) ?? hex}</span>
                </div>
              </div>
            );
          }

          // PATH, STRING livre e demais tipos: input de texto simples
          return (
            <div key={propDef.name} className="prop-row">
              <label className="prop-label">{propDef.name}</label>
              <input
                className="text-input"
                type="text"
                value={(value as string) ?? ""}
                onChange={(e) => onChange(propDef.name, e.target.value)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
