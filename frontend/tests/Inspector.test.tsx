// Cobre a regra central do Inspector (CLAUDE.md): não conhece tipo de
// elemento hardcoded, só escolhe o input pelo PropType. Um ElementDef
// fake com uma propriedade de cada tipo já cobre todos os ramos do
// componente sem precisar de nenhum elemento real do schema.

import { describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";
import { Inspector } from "../src/components/Inspector";
import type { ElementDef, ThemeElement } from "../src/schema/types";

afterEach(cleanup);

const ELEMENT_DEF: ElementDef = {
  group: "secondary",
  views: ["gamelist"],
  instancesPerView: "multiple",
  defaultZIndex: 30,
  properties: [
    { name: "pos", type: "NORMALIZED_PAIR", default: [0, 0], minValue: null, maxValue: null, validValues: null, onlyWhen: null },
    { name: "zIndex", type: "UNSIGNED_INTEGER", default: 30, minValue: 0, maxValue: null, validValues: null, onlyWhen: null },
    { name: "tile", type: "BOOLEAN", default: false, minValue: null, maxValue: null, validValues: null, onlyWhen: null },
    { name: "color", type: "COLOR", default: "FFFFFFFF", minValue: null, maxValue: null, validValues: null, onlyWhen: null },
    {
      name: "horizontalAlignment",
      type: "STRING",
      default: "left",
      minValue: null,
      maxValue: null,
      validValues: ["left", "center", "right"],
      onlyWhen: null,
    },
    { name: "path", type: "PATH", default: "", minValue: null, maxValue: null, validValues: null, onlyWhen: null },
  ],
};

const ELEMENT: ThemeElement = {
  type: "image",
  name: "frame1",
  properties: {
    pos: [0.5, 0.25],
    zIndex: 10,
    tile: true,
    color: "112233FF",
    horizontalAlignment: "center",
    path: "./core/frame.png",
  },
};

describe("Inspector — estados sem elemento", () => {
  it("mostra 'Selecione um elemento' quando nada está selecionado", () => {
    render(<Inspector element={null} elementDef={null} onChange={vi.fn()} />);
    expect(screen.getByText(/Selecione um elemento no canvas/)).toBeInTheDocument();
  });

  it("mostra a contagem quando multiSelectedCount > 1, mesmo com element/elementDef presentes", () => {
    render(
      <Inspector element={ELEMENT} elementDef={ELEMENT_DEF} multiSelectedCount={3} onChange={vi.fn()} />
    );
    expect(screen.getByText(/3 elementos selecionados/)).toBeInTheDocument();
    expect(screen.queryByText("image")).not.toBeInTheDocument();
  });

  it("edita normalmente quando multiSelectedCount é 1 ou 0", () => {
    render(<Inspector element={ELEMENT} elementDef={ELEMENT_DEF} multiSelectedCount={1} onChange={vi.fn()} />);
    expect(screen.getByText("image")).toBeInTheDocument();
  });
});

describe("Inspector — escolha de input por PropType", () => {
  it("NORMALIZED_PAIR: dois inputs numéricos com os valores de X/Y", () => {
    render(<Inspector element={ELEMENT} elementDef={ELEMENT_DEF} onChange={vi.fn()} />);
    const posRow = screen.getByText("pos").closest(".prop-row")!;
    const inputs = posRow.querySelectorAll("input");
    expect(inputs).toHaveLength(2);
    expect((inputs[0] as HTMLInputElement).value).toBe("0.5");
    expect((inputs[1] as HTMLInputElement).value).toBe("0.25");
  });

  it("NORMALIZED_PAIR: editar X chama onChange com [novoX, yAntigo]", () => {
    const onChange = vi.fn();
    render(<Inspector element={ELEMENT} elementDef={ELEMENT_DEF} onChange={onChange} />);
    const posRow = screen.getByText("pos").closest(".prop-row")!;
    const [xInput] = posRow.querySelectorAll("input");
    fireEvent.change(xInput, { target: { value: "0.75" } });
    expect(onChange).toHaveBeenCalledWith("pos", [0.75, 0.25]);
  });

  it("UNSIGNED_INTEGER: input numérico respeitando minValue", () => {
    render(<Inspector element={ELEMENT} elementDef={ELEMENT_DEF} onChange={vi.fn()} />);
    const row = screen.getByText("zIndex").closest(".prop-row")!;
    const input = row.querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("10");
    expect(input.min).toBe("0");
  });

  it("BOOLEAN: checkbox refletindo o valor e onChange com o novo boolean", () => {
    const onChange = vi.fn();
    render(<Inspector element={ELEMENT} elementDef={ELEMENT_DEF} onChange={onChange} />);
    const row = screen.getByText("tile").closest(".prop-row")!;
    const checkbox = row.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith("tile", false);
  });

  it("COLOR: input color + hex textual com o valor real", () => {
    render(<Inspector element={ELEMENT} elementDef={ELEMENT_DEF} onChange={vi.fn()} />);
    const row = screen.getByText("color").closest(".prop-row")!;
    const colorInput = row.querySelector('input[type="color"]') as HTMLInputElement;
    expect(colorInput.value).toBe("#112233");
    expect(row.querySelector(".color-field-hex")?.textContent).toBe("#112233FF");
  });

  it("STRING com validValues: select com as opções do schema", () => {
    render(<Inspector element={ELEMENT} elementDef={ELEMENT_DEF} onChange={vi.fn()} />);
    const row = screen.getByText("horizontalAlignment").closest(".prop-row")!;
    const select = row.querySelector("select") as HTMLSelectElement;
    expect(select.value).toBe("center");
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["left", "center", "right"]);
  });

  it("PATH: input de texto simples", () => {
    render(<Inspector element={ELEMENT} elementDef={ELEMENT_DEF} onChange={vi.fn()} />);
    const row = screen.getByText("path").closest(".prop-row")!;
    const input = row.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input.value).toBe("./core/frame.png");
  });
});

describe("Inspector — badge de tipo por grupo do schema", () => {
  it("usa --badge-primary-group quando elementDef.group === 'primary'", () => {
    render(
      <Inspector
        element={ELEMENT}
        elementDef={{ ...ELEMENT_DEF, group: "primary" }}
        onChange={vi.fn()}
      />
    );
    const badge = screen.getByText("image");
    expect(badge.style.getPropertyValue("--type-badge-color")).toBe("var(--badge-primary-group)");
  });

  it("usa --badge-secondary-group quando elementDef.group === 'secondary'", () => {
    render(<Inspector element={ELEMENT} elementDef={ELEMENT_DEF} onChange={vi.fn()} />);
    const badge = screen.getByText("image");
    expect(badge.style.getPropertyValue("--type-badge-color")).toBe("var(--badge-secondary-group)");
  });
});
