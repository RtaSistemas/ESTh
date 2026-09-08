// Espelha backend/tests/test_geometry.py — geometry.ts é uma cópia manual
// de backend/app/geometry.py (ver comentário no topo do arquivo), então o
// invariante central (resolve/invert são exatamente inversas) precisa
// valer nos dois lados.

import { describe, expect, it } from "vitest";
import { boxToPosAndSize, boxTopLeftToPos, resolveElementBox } from "../src/geometry";

const REFERENCE: [number, number] = [1920, 1080];

describe("resolveElementBox", () => {
  it("origin top-left: box começa exatamente em pos*reference", () => {
    const box = resolveElementBox([0.1, 0.2], [0.3, 0.4], [0, 0], REFERENCE);
    expect(box.x).toBeCloseTo(0.1 * 1920);
    expect(box.y).toBeCloseTo(0.2 * 1080);
    expect(box.width).toBeCloseTo(0.3 * 1920);
    expect(box.height).toBeCloseTo(0.4 * 1080);
  });

  it("origin (0.5, 0.5) com pos (0.5, 0.5) centraliza o elemento na tela", () => {
    const box = resolveElementBox([0.5, 0.5], [0.2, 0.2], [0.5, 0.5], REFERENCE);
    expect(box.x + box.width / 2).toBeCloseTo(1920 / 2);
    expect(box.y + box.height / 2).toBeCloseTo(1080 / 2);
  });
});

describe("resolveElementBox + boxTopLeftToPos: round-trip", () => {
  const cases: Array<{ pos: [number, number]; size: [number, number]; origin: [number, number] }> = [
    { pos: [0, 0], size: [0.25, 0.155], origin: [0, 0] },
    { pos: [0.5, 0.5], size: [0.8, 0.8], origin: [0.5, 0.5] },
    { pos: [1, 1], size: [0.1, 0.1], origin: [1, 1] },
    { pos: [0.27, 0.32], size: [0.12, 0.41], origin: [0.5, 0.5] },
  ];

  it.each(cases)("recupera pos original para %o", ({ pos, size, origin }) => {
    const box = resolveElementBox(pos, size, origin, REFERENCE);
    const recovered = boxTopLeftToPos({ x: box.x, y: box.y }, size, origin, REFERENCE);
    expect(recovered[0]).toBeCloseTo(pos[0]);
    expect(recovered[1]).toBeCloseTo(pos[1]);
  });
});

describe("boxToPosAndSize", () => {
  it("é o inverso de resolveElementBox quando pos e size mudam juntos (resize)", () => {
    const originalPos: [number, number] = [0.5, 0.5];
    const originalSize: [number, number] = [0.8, 0.8];
    const origin: [number, number] = [0.5, 0.5];
    const box = resolveElementBox(originalPos, originalSize, origin, REFERENCE);

    // Simula um resize: estica o canto se (bottom-right) 200px em cada eixo,
    // mantendo o canto nw fixo.
    const resized = { x: box.x, y: box.y, width: box.width + 200, height: box.height + 100 };
    const { pos, size } = boxToPosAndSize(resized, origin, REFERENCE);

    // Reaplicando resolveElementBox com o resultado tem que reproduzir
    // exatamente o box redimensionado (nw fixo, size maior).
    const rebuilt = resolveElementBox(pos, size, origin, REFERENCE);
    expect(rebuilt.x).toBeCloseTo(resized.x);
    expect(rebuilt.y).toBeCloseTo(resized.y);
    expect(rebuilt.width).toBeCloseTo(resized.width);
    expect(rebuilt.height).toBeCloseTo(resized.height);
  });
});
