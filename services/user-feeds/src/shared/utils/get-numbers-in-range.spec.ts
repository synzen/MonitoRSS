import { getNumbersInRange } from "./get-numbers-in-range";

describe("getNumbersInRange", () => {
  it("throws if max is less than min", () => {
    expect(() => {
      getNumbersInRange({
        countToGet: 1,
        max: 1,
        min: 2,
        random: true,
      });
    }).toThrow();
  });

  it("should return an array of numbers", () => {
    const result = getNumbersInRange({
      countToGet: 1,
      max: 1,
      min: 1,
      random: true,
    });
    expect(result).toEqual([1]);
  });

  it("should return the correct number of numbers", () => {
    const result = getNumbersInRange({
      countToGet: 5,
      max: 10,
      min: 1,
      random: true,
    });

    expect(result).toHaveLength(5);
  });

  it("should return the correct numbers when random is true", () => {
    const result = getNumbersInRange({
      countToGet: 5,
      max: 10,
      min: 1,
      random: true,
    });

    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).toEqual(
      expect.arrayContaining(result)
    );
  });

  it("should return the correct numbers when random is false", () => {
    const result = getNumbersInRange({
      countToGet: 5,
      max: 10,
      min: 1,
      random: false,
    });

    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it(
    "should return the correct numbers when random is false" +
      "and countToGet is greater than max",
    () => {
      const result = getNumbersInRange({
        countToGet: 15,
        max: 10,
        min: 1,
        random: false,
      });

      expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    }
  );
});
