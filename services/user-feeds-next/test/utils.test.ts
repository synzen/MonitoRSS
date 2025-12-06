import { describe, expect, it } from "bun:test";
import { replaceTemplateString } from "../src/article-formatter";

describe("replaceTemplateString", () => {
  it("returns the input if the string is falsy", () => {
    const str = replaceTemplateString(
      {
        id: "1",
      },
      undefined
    );
    expect(str).toBeUndefined();
  });

  it("replaces {{empty}} with empty text", () => {
    const object = {
      title: "hello world",
    };

    const str = "{{empty}}";
    const outputStr = replaceTemplateString(object, str);

    expect(outputStr).toBe("");
  });

  it("replaces top-level values", () => {
    const object = {
      foo: "1",
      bar: "2",
    };

    const str = "foo: {{foo}}, bar: {{bar}}";
    const outputStr = replaceTemplateString(object, str);

    expect(outputStr).toBe("foo: 1, bar: 2");
  });

  it("replaces all instances", () => {
    const object = {
      foo: "1",
      bar: "2",
    };

    const str = "foo: {{foo}}, bar: {{bar}}, foo: {{foo}}";
    const outputStr = replaceTemplateString(object, str);

    expect(outputStr).toBe("foo: 1, bar: 2, foo: 1");
  });

  it("works with split options", () => {
    const object = {
      foo: "".padEnd(2000, "a"),
    };

    const str = "foo: {{foo}}";
    expect(
      replaceTemplateString(object as never, str, {
        split: {
          func: (str, { appendString }) =>
            str.slice(0, 1) + (appendString ?? ""),
          limits: [
            {
              placeholder: "foo",
              characterCount: 1,
              appendString: "...",
            },
          ],
        },
      })
    ).toBe("foo: a...");
  });

  it("works with || when there is no fallback support", () => {
    const object = {
      "foo||bar": "2",
    };

    const str = "foo: {{foo||bar}}";
    expect(replaceTemplateString(object, str)).toBe("foo: 2");
  });

  describe("with fallback support", () => {
    it("works with fallbacks", () => {
      const object = {
        bar: "2",
      };

      const str = "foo: {{foo||bar}}";
      expect(
        replaceTemplateString(object, str, {
          supportFallbacks: true,
        })
      ).toBe("foo: 2");
    });

    it("works with multiple fallbacks", () => {
      const object = {
        baz: "2",
      };

      const str = "foo: {{foo||bar||baz}}";
      expect(
        replaceTemplateString(object, str, {
          supportFallbacks: true,
        })
      ).toBe("foo: 2");
    });

    it("works with text fallback", () => {
      const object = {};

      const str = "foo: {{foo||bar||text::hello world}}";
      expect(
        replaceTemplateString(object, str, {
          supportFallbacks: true,
        })
      ).toBe("foo: hello world");
    });

    it("stops at the first available fallback", () => {
      const object = {
        bar: "2",
        baz: "3",
      };

      const str = "foo: {{foo||bar||baz}}";
      expect(
        replaceTemplateString(object, str, {
          supportFallbacks: true,
        })
      ).toBe("foo: 2");
    });
  });
});

// getNestedPrimitiveValue tests will be added when it's implemented in article-formatter
// The original implementation uses object-path and ARTICLE_FIELD_DELIMITER (__) to access nested values
