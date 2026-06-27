import { describe, it, expect } from "vitest";
import { ProductKey } from "./productKey";
import { PLAN_DISPLAY_NAMES, getPlanDisplayName, PlanDisplayName } from "./planDisplayName";

describe("plan display-name mapping", () => {
  it("maps free to Free", () => {
    expect(getPlanDisplayName(ProductKey.Free)).toBe(PlanDisplayName.Free);
    expect(PLAN_DISPLAY_NAMES[ProductKey.Free]).toBe("Free");
  });

  it("maps tier1 to Personal", () => {
    expect(getPlanDisplayName(ProductKey.Tier1)).toBe(PlanDisplayName.Personal);
    expect(PLAN_DISPLAY_NAMES[ProductKey.Tier1]).toBe("Personal");
  });

  it("maps the team tier family (tier2/tier3/t3feed) to Team", () => {
    expect(getPlanDisplayName(ProductKey.Tier2)).toBe(PlanDisplayName.Team);
    expect(getPlanDisplayName(ProductKey.Tier3)).toBe(PlanDisplayName.Team);
    expect(getPlanDisplayName(ProductKey.Tier3Feed)).toBe(PlanDisplayName.Team);
    expect(PLAN_DISPLAY_NAMES[ProductKey.Tier2]).toBe("Team");
  });

  it("does not surface any 'Tier N' string in the display names", () => {
    Object.values(PLAN_DISPLAY_NAMES).forEach((name) => {
      expect(name).not.toMatch(/tier\s*[123]/i);
    });
  });
});
