import { IsValidTimezone } from "./is-valid-timezone";

describe("IsValidTimezone", () => {
  let constraint: IsValidTimezone;

  beforeEach(() => {
    constraint = new IsValidTimezone();
  });

  describe("validate", () => {
    it("returns false if timezone is invalid", () => {
      const timezone = "fake";
      expect(constraint.validate(timezone)).toBe(false);
    });

    it("returns true if timezone is valid", () => {
      const timezone = "Europe/Paris";
      expect(constraint.validate(timezone)).toBe(true);
    });
  });

  describe("defaultMessage", () => {
    it("returns a string", () => {
      expect(typeof constraint.defaultMessage()).toBe("string");
    });
  });
});
