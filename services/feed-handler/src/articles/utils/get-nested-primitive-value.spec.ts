import { getNestedPrimitiveValue } from "./get-nested-primitive-value";

describe("getNestedPrimitiveValue", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let obj: Record<string, any>;

  beforeEach(() => {
    obj = {
      foo: {
        bar: {
          a: "1",
        },
      },
    };
  });

  it("returns a nested string", async () => {
    obj.foo.bar.a = "1";

    const val = getNestedPrimitiveValue(obj, "foo__bar__a");
    expect(val).toEqual("1");
  });

  it("returns nested numbers as strings", async () => {
    obj.foo.bar.a = 1;

    const val = getNestedPrimitiveValue(obj, "foo__bar__a");
    expect(val).toEqual("1");
  });

  it("returns nested dates as strings", async () => {
    const date = new Date("2021");
    obj.foo.bar.a = date;

    const val = getNestedPrimitiveValue(obj, "foo__bar__a");
    expect(val).toEqual(date.toISOString());
  });

  it("returns invalid dates as null", async () => {
    const date = new Date("abc");
    obj.foo.bar.a = date;

    const val = getNestedPrimitiveValue(obj, "foo__bar__a");
    expect(val).toEqual(null);
  });

  it("returns objects as null", async () => {
    obj.foo.bar.a = {};

    const val = getNestedPrimitiveValue(obj, "foo__bar__a");
    expect(val).toEqual(null);
  });

  it("returns arrays as null", async () => {
    obj.foo.bar.a = [];

    const val = getNestedPrimitiveValue(obj, "foo__bar__a");
    expect(val).toEqual(null);
  });

  it("returns non-existent fields as null", async () => {
    obj.foo = {};

    const val = getNestedPrimitiveValue(obj, "foo__bar__a");
    expect(val).toEqual(null);
  });

  it("returns array index values", async () => {
    obj.foo.bar.a = ["a", "b"];

    const val = getNestedPrimitiveValue(obj, "foo__bar__a__1");
    expect(val).toEqual("b");
  });

  it("returns null/undefined as null", async () => {
    obj.foo.bar.a = undefined;
    expect(getNestedPrimitiveValue(obj, "foo__bar__a")).toEqual(null);

    obj.foo.bar.a = null;
    expect(getNestedPrimitiveValue(obj, "foo__bar__a")).toEqual(null);
  });
});
