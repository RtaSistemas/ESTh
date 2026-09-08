import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearPersistedProject,
  loadPersistedProject,
  savePersistedProject,
  type PersistedProject,
} from "../src/persistence";
import type { ThemeModel } from "../src/schema/types";

const SAMPLE_MODEL: ThemeModel = {
  views: {
    system: [],
    gamelist: [
      { type: "image", name: "frame1", properties: { pos: [0.5, 0.5], zIndex: 10 } },
    ],
  },
  warnings: [],
  variables: {},
};

const SAMPLE_PROJECT: PersistedProject = {
  model: SAMPLE_MODEL,
  view: "gamelist",
  selectedScheme: "dark",
  colorSchemes: [{ name: "dark", displayName: "Dark" }],
  variablesByScheme: { dark: { gameNameColor: "000000FF" } },
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("loadPersistedProject", () => {
  it("retorna null quando não há nada salvo", () => {
    expect(loadPersistedProject()).toBeNull();
  });

  it("retorna null se o JSON salvo estiver corrompido — nunca deve quebrar o editor", () => {
    localStorage.setItem("esth:project:v1", "{ isso não é json válido");
    expect(loadPersistedProject()).toBeNull();
  });

  it("retorna null se o objeto salvo não tiver um model.views válido", () => {
    localStorage.setItem("esth:project:v1", JSON.stringify({ view: "gamelist" }));
    expect(loadPersistedProject()).toBeNull();
  });

  it("recupera exatamente o que foi salvo", () => {
    savePersistedProject(SAMPLE_PROJECT);
    expect(loadPersistedProject()).toEqual(SAMPLE_PROJECT);
  });
});

describe("clearPersistedProject", () => {
  it("remove o projeto salvo", () => {
    savePersistedProject(SAMPLE_PROJECT);
    clearPersistedProject();
    expect(loadPersistedProject()).toBeNull();
  });
});
