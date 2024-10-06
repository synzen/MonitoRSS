import { getNumbersInRange } from "./get-numbers-in-range";
import { describe, it } from "node:test";
import assert from "assert";

describe("getNumbersInRange", () => {
  it("throws if max is less than min", () => {
    assert.throws(() => {
      getNumbersInRange({
        countToGet: 1,
        max: 1,
        min: 2,
        random: true,
      });
    });
  });

  it("should return an array of numbers", () => {
    const result = getNumbersInRange({
      countToGet: 1,
      max: 1,
      min: 1,
      random: true,
    });
    assert.deepStrictEqual(result, [1]);
  });

  it("should return the correct number of numbers", () => {
    const result = getNumbersInRange({
      countToGet: 5,
      max: 10,
      min: 1,
      random: true,
    });

    assert.strictEqual(result.length, 5);
  });

  it("should return the correct numbers when random is true", () => {
    const result = getNumbersInRange({
      countToGet: 5,
      max: 10,
      min: 1,
      random: true,
    });

    const possibilities = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    assert.deepStrictEqual(result.length, 5);

    result.forEach((num) => {
      assert.deepStrictEqual(possibilities.includes(num), true);
    });
  });

  it("should return the correct numbers when random is false", () => {
    const result = getNumbersInRange({
      countToGet: 5,
      max: 10,
      min: 1,
      random: false,
    });

    assert.deepStrictEqual(result, [1, 2, 3, 4, 5]);
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

      assert.deepStrictEqual(result, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    }
  );
});
