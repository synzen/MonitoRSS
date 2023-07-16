import { replaceTemplateString } from "./replace-template-string";

describe("replaceTemplateString", () => {
  it("returns the input if the string is falsy", () => {
    const str = replaceTemplateString(
      {
        id: "1",
      },
      undefined
    );
    expect(str).toEqual(undefined);
  });

  it("replaces {{empty}} with empty text", () => {
    const object = {
      title: "hello world",
    };

    const str = "{{empty}}";
    const outputStr = replaceTemplateString(object, str);

    expect(outputStr).toEqual("");
  });

  it("replaces top-level values", () => {
    const object = {
      foo: "1",
      bar: "2",
    };

    const str = "foo: {{foo}}, bar: {{bar}}";
    const outputStr = replaceTemplateString(object, str);

    expect(outputStr).toEqual("foo: 1, bar: 2");
  });

  it("replaces all instances", () => {
    const object = {
      foo: "1",
      bar: "2",
    };

    const str = "foo: {{foo}}, bar: {{bar}}, foo: {{foo}}";
    const outputStr = replaceTemplateString(object, str);

    expect(outputStr).toEqual("foo: 1, bar: 2, foo: 1");
  });

  it("throws an error when object values are not strings", () => {
    const object = {
      foo: 1,
      bar: 2,
    };

    const str = "foo: {{foo}}, bar: {{bar}}";
    expect(() => replaceTemplateString(object as never, str)).toThrowError();
  });

  it("works with split options", () => {
    const object = {
      foo: "".padEnd(2000, "a"),
    };

    const str = "foo: {{foo}}";
    expect(
      replaceTemplateString(object as never, str, {
        split: {
          func: (str, { appendString }) => str.slice(0, 1) + appendString,
          limits: [
            {
              key: "foo",
              limit: 1,
              appendString: "...",
            },
          ],
        },
      })
    ).toEqual("foo: a...");
  });
});
