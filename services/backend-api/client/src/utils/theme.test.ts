import { describe, expect, it } from "vitest";
import { system } from "./theme";

/**
 * Guards the Tier-1 recipe wiring that call sites depend on implicitly. If any of
 * these regress, call sites won't fail to compile — surfaces just silently change
 * color (e.g. buttons inside status Alerts inherit the alert's palette via the
 * colorPalette CSS-var cascade, or control edges drop below the WCAG 1.4.11 ratio).
 */
describe("theme system", () => {
  it("pins the button recipe to the neutral palette so ambient palettes never cascade in", () => {
    const recipe = system.getRecipe("button");

    expect(recipe.base?.colorPalette).toBe("gray");
  });

  it("defaults buttons to the outline variant with the controlBorder edge", () => {
    const recipe = system.getRecipe("button");

    expect(recipe.defaultVariants?.variant).toBe("outline");
    expect(recipe.variants?.variant?.outline?.borderColor).toBe("controlBorder");
  });

  it("points recipe-driven control outlines at controlBorder", () => {
    for (const name of ["input", "textarea"]) {
      expect(system.getRecipe(name).variants?.variant?.outline?.borderColor).toBe("controlBorder");
    }

    expect(
      system.getSlotRecipe("nativeSelect").variants?.variant?.outline?.field?.borderColor,
    ).toBe("controlBorder");
  });

  it("pins checked checkbox/radio fills to the brand palette", () => {
    expect(system.getSlotRecipe("checkbox").base?.root?.colorPalette).toBe("brand");
    expect(system.getSlotRecipe("radioGroup").base?.root?.colorPalette).toBe("brand");
  });

  it("resolves the controlBorder semantic token", () => {
    expect(system.token("colors.controlBorder")).toBeTruthy();
  });
});
