// @vitest-environment node
//
// Roda em Node puro, não jsdom: o File/Blob do jsdom não é reconhecido
// pelo clone estruturado do fake-indexeddb (o valor volta um objeto vazio,
// sem o binário) — um problema de interop do ambiente de teste, não do
// código real (num navegador de verdade isso não acontece). assetStorage.ts
// não toca em DOM, só em IndexedDB, então rodar em Node é fiel ao que
// importa aqui.
import { beforeEach, describe, expect, it } from "vitest";
import { clearAssetFiles, loadAllAssetFiles, saveAssetFile } from "../src/assetStorage";

// IndexedDB real (via fake-indexeddb, ver tests/setup.ts) não tem um jeito
// simples de "resetar" entre testes — cada teste limpa o que criou.
beforeEach(async () => {
  await clearAssetFiles();
});

describe("assetStorage", () => {
  it("loadAllAssetFiles retorna vazio quando nada foi salvo", async () => {
    expect(await loadAllAssetFiles()).toEqual({});
  });

  it("salva e recupera um arquivo pelo path", async () => {
    const file = new File(["conteúdo fake"], "frame.png", { type: "image/png" });
    await saveAssetFile("./core/frame.png", file);

    const files = await loadAllAssetFiles();
    expect(Object.keys(files)).toEqual(["./core/frame.png"]);
    expect(files["./core/frame.png"].size).toBe(file.size);
  });

  it("saveAssetFile com a mesma key sobrescreve o arquivo anterior", async () => {
    await saveAssetFile("./core/frame.png", new File(["a"], "frame.png"));
    await saveAssetFile("./core/frame.png", new File(["bb"], "frame.png"));

    const files = await loadAllAssetFiles();
    expect(Object.keys(files)).toHaveLength(1);
    expect(files["./core/frame.png"].size).toBe(2);
  });

  it("clearAssetFiles remove todos os arquivos salvos", async () => {
    await saveAssetFile("./core/frame.png", new File(["a"], "frame.png"));
    await clearAssetFiles();
    expect(await loadAllAssetFiles()).toEqual({});
  });
});
