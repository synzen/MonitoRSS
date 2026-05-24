import { describe, it } from "node:test";
import assert from "node:assert";
import { replaceTemplateString } from ".";

describe("replaceTemplateString", () => {
  it("returns the input if the string is falsy", () => {
    const str = replaceTemplateString(
      {
        id: "1",
      },
      undefined
    );
    assert.strictEqual(str, undefined);
  });

  it("replaces {{empty}} with empty text", () => {
    const object = {
      title: "hello world",
    };

    const str = "{{empty}}";
    const outputStr = replaceTemplateString(object, str);

    assert.strictEqual(outputStr, "");
  });

  it("replaces top-level values", () => {
    const object = {
      foo: "1",
      bar: "2",
    };

    const str = "foo: {{foo}}, bar: {{bar}}";
    const outputStr = replaceTemplateString(object, str);

    assert.strictEqual(outputStr, "foo: 1, bar: 2");
  });

  it("replaces all instances", () => {
    const object = {
      foo: "1",
      bar: "2",
    };

    const str = "foo: {{foo}}, bar: {{bar}}, foo: {{foo}}";
    const outputStr = replaceTemplateString(object, str);

    assert.strictEqual(outputStr, "foo: 1, bar: 2, foo: 1");
  });

  it("works with split options", () => {
    const object = {
      foo: "".padEnd(2000, "a"),
    };

    const str = "foo: {{foo}}";
    assert.strictEqual(
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
      }),
      "foo: a..."
    );
  });

  it("works with || when there is no fallback support", () => {
    const object = {
      "foo||bar": "2",
    };

    const str = "foo: {{foo||bar}}";
    assert.strictEqual(replaceTemplateString(object, str), "foo: 2");
  });

  describe("with fallback support", () => {
    it("works with fallbacks", () => {
      const object = {
        bar: "2",
      };

      const str = "foo: {{foo||bar}}";
      assert.strictEqual(
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
      assert.strictEqual(
        replaceTemplateString(object, str, {
          supportFallbacks: true,
        }),
        "foo: 2"
      );
    });

    it("works with text fallback", () => {
      const object = {};

      const str = "foo: {{foo||bar||text::hello world}}";
      assert.strictEqual(
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
      assert.strictEqual(
        replaceTemplateString(object, str, {
          supportFallbacks: true,
        }),
        "foo: 2"
      );
    });
  });
});

// getNestedPrimitiveValue tests will be added when it's implemented in article-formatter
// The original implementation uses object-path and ARTICLE_FIELD_DELIMITER (__) to access nested values
