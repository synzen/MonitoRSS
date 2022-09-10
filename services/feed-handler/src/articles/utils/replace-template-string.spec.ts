import { replaceTemplateString } from "./replace-template-string";

describe("replaceTemplateString", () => {
  it("returns the input if the string is falsy", () => {
    const str = replaceTemplateString({}, undefined);
    expect(str).toEqual(undefined);
  });
  it("replaces top-level values", () => {
    const object = {
      foo: 1,
      bar: "2",
    };

    const str = "foo: {{foo}}, bar: {{bar}}";
    const outputStr = replaceTemplateString(object, str);

    expect(outputStr).toEqual("foo: 1, bar: 2");
  });

  it("replaces nested values", () => {
    const object = {
      foo: {
        bar: {
          a: "1",
        },
      },
      faz: ["a"],
    };

    const str = "foo: {{foo__bar__a}}, faz: {{faz__0}}";
    const outputStr = replaceTemplateString(object, str);

    expect(outputStr).toEqual("foo: 1, faz: a");
  });

  it("replaces all instances", () => {
    const object = {
      foo: 1,
      bar: "2",
    };

    const str = "foo: {{foo}}, bar: {{bar}}, foo: {{foo}}";
    const outputStr = replaceTemplateString(object, str);

    expect(outputStr).toEqual("foo: 1, bar: 2, foo: 1");
  });
});
