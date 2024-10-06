import { replaceTemplateString } from "./replace-template-string";
import { describe, it } from "node:test";
import { deepStrictEqual, throws } from "node:assert";

describe("replaceTemplateString", () => {
  it("returns the input if the string is falsy", () => {
    const str = replaceTemplateString(
      {
        id: "1",
      },
      undefined
    );
    deepStrictEqual(str, undefined);
  });

  it("replaces {{empty}} with empty text", () => {
    const object = {
      title: "hello world",
    };

    const str = "{{empty}}";
    const outputStr = replaceTemplateString(object, str);

    deepStrictEqual(outputStr, "");
  });

  it("replaces top-level values", () => {
    const object = {
      foo: "1",
      bar: "2",
    };

    const str = "foo: {{foo}}, bar: {{bar}}";
    const outputStr = replaceTemplateString(object, str);

    deepStrictEqual(outputStr, "foo: 1, bar: 2");
  });

  it("replaces all instances", () => {
    const object = {
      foo: "1",
      bar: "2",
    };

    const str = "foo: {{foo}}, bar: {{bar}}, foo: {{foo}}";
    const outputStr = replaceTemplateString(object, str);

    deepStrictEqual(outputStr, "foo: 1, bar: 2, foo: 1");
  });

  it("throws an error when object values are not strings", () => {
    const object = {
      foo: 1,
      bar: 2,
    };

    const str = "foo: {{foo}}, bar: {{bar}}";
    throws(() => replaceTemplateString(object as never, str), Error);
  });

  it("works with split options", () => {
    const object = {
      foo: "".padEnd(2000, "a"),
    };

    const str = "foo: {{foo}}";
    deepStrictEqual(
      replaceTemplateString(object as never, str, {
        split: {
          func: (str, { appendString }) => str.slice(0, 1) + appendString,
          limits: [
            {
              key: "foo",
              characterCount: 1,
              appendString: "...",
            },
          ],
        },
      }),
      "foo: a..."
    );
  });

  it("works with || when there is no fallback support", () => {
    const object = {
      "foo||bar": "2",
    };

    const str = "foo: {{foo||bar}}";
    deepStrictEqual(replaceTemplateString(object, str), "foo: 2");
  });

  describe("with fallback support", () => {
    it("works with fallbacks", () => {
      const object = {
        bar: "2",
      };

      const str = "foo: {{foo||bar}}";
      deepStrictEqual(
        replaceTemplateString(object, str, {
          supportFallbacks: true,
        }),
        "foo: 2"
      );
    });

    it("works with multiple fallbacks", () => {
      const object = {
        baz: "2",
      };

      const str = "foo: {{foo||bar||baz}}";
      deepStrictEqual(
        replaceTemplateString(object, str, {
          supportFallbacks: true,
        }),
        "foo: 2"
      );
    });

    it("works with text fallback", () => {
      const object = {};

      const str = "foo: {{foo||bar||text::hello world}}";
      deepStrictEqual(
        replaceTemplateString(object, str, {
          supportFallbacks: true,
        }),
        "foo: hello world"
      );
    });

    it("stops at the first available fallback", () => {
      const object = {
        bar: "2",
        baz: "3",
      };

      const str = "foo: {{foo||bar||baz}}";
      deepStrictEqual(
        replaceTemplateString(object, str, {
          supportFallbacks: true,
        }),
        "foo: 2"
      );
    });

    it("stops at the first available fallback", () => {
      const object = {
        bar: "2",
        baz: "3",
      };

      const str = "foo: {{foo||bar||baz}}";
      deepStrictEqual(
        replaceTemplateString(object, str, {
          supportFallbacks: true,
        }),
        "foo: 2"
      );
    });
  });
});
