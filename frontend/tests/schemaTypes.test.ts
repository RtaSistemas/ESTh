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

  it("resolve uma variável embutida no meio de uma string maior", () => {
    // Achado testando com o theme.xml real do Iconic:
    // "./_inc/images/${backgroundArtGradientImage}" — a regex antiga (só
    // whole-string) não pegava isso, deixava a referência sem resolver.
    expect(
      resolveVariable("./_inc/images/${bgGradient}", { bgGradient: "gradient-dark.svg" })
    ).toBe("./_inc/images/gradient-dark.svg");
  });

  it("resolve múltiplas variáveis na mesma string, cada uma pro seu valor", () => {
    expect(
      resolveVariable("${a}-${b}", { a: "1", b: "2" })
    ).toBe("1-2");
  });

  it("mantém sem resolver a parte embutida cuja variável não existe", () => {
    expect(
      resolveVariable("./_inc/images/${missing}", { other: "x" })
    ).toBe("./_inc/images/${missing}");
  });
});
