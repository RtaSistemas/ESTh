import { describe, expect, it } from "vitest";
import { resolveVariable } from "../src/schema/types";

describe("resolveVariable", () => {
  it("resolve uma referência ${nome} quando a variável existe", () => {
    expect(resolveVariable("${gameNameColor}", { gameNameColor: "445566FF" })).toBe("445566FF");
  });

  it("mantém a referência original se a variável não existe no dict", () => {
    expect(resolveVariable("${missing}", { gameNameColor: "445566FF" })).toBe("${missing}");
  });

  it("mantém a referência original se nenhum dict de variáveis foi importado", () => {
    expect(resolveVariable("${gameNameColor}", undefined)).toBe("${gameNameColor}");
  });

  it("um valor literal (não ${...}) passa direto, com ou sem dict", () => {
    expect(resolveVariable("FFFFFFFF", { gameNameColor: "445566FF" })).toBe("FFFFFFFF");
    expect(resolveVariable("FFFFFFFF", undefined)).toBe("FFFFFFFF");
  });
});
