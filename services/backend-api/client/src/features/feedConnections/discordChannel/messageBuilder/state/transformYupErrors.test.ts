import { describe, it, expect } from "vitest";
import * as yup from "yup";
import { transformYupErrors } from "./transformYupErrors";

describe("transformYupErrors", () => {
  it("returns empty object for no errors", () => {
    expect(transformYupErrors([])).toEqual({});
  });

  it("converts a single flat path error", () => {
    const inner = [
      {
        path: "messageComponent.content",
        message: "Content is required",
        type: "required",
      },
    ] as yup.ValidationError[];

    const result = transformYupErrors(inner);

    expect(result).toEqual({
      messageComponent: {
        content: { message: "Content is required", type: "required" },
      },
    });
  });

  it("converts nested children array path", () => {
    const inner = [
      {
        path: "messageComponent.children.0.children.1.content",
        message: "Required",
        type: "required",
      },
    ] as yup.ValidationError[];

    const result = transformYupErrors(inner);

    expect(result.messageComponent.children[0].children[1].content).toEqual({
      message: "Required",
      type: "required",
    });
  });

  it("converts multiple errors at different paths", () => {
    const inner = [
      {
        path: "messageComponent.children.0.content",
        message: "Too long",
        type: "max",
      },
      {
        path: "messageComponent.children.1.label",
        message: "Required",
        type: "required",
      },
    ] as yup.ValidationError[];

    const result = transformYupErrors(inner);

    expect(result.messageComponent.children[0].content).toEqual({
      message: "Too long",
      type: "max",
    });
    expect(result.messageComponent.children[1].label).toEqual({
      message: "Required",
      type: "required",
    });
  });

  it("handles accessory path", () => {
    const inner = [
      {
        path: "messageComponent.children.0.accessory.label",
        message: "Required",
        type: "required",
      },
    ] as yup.ValidationError[];

    const result = transformYupErrors(inner);

    expect(result.messageComponent.children[0].accessory.label).toEqual({
      message: "Required",
      type: "required",
    });
  });

  it("handles array-level validation (e.g. min children)", () => {
    const inner = [
      {
        path: "messageComponent.children",
        message: "Must have at least 1 child",
        type: "min",
      },
    ] as yup.ValidationError[];

    const result = transformYupErrors(inner);

    expect(result.messageComponent.children).toEqual({
      message: "Must have at least 1 child",
      type: "min",
    });
  });

  it("preserves sparse array structure", () => {
    const inner = [
      {
        path: "messageComponent.children.2.content",
        message: "Required",
        type: "required",
      },
    ] as yup.ValidationError[];

    const result = transformYupErrors(inner);

    expect(result.messageComponent.children[0]).toBeUndefined();
    expect(result.messageComponent.children[1]).toBeUndefined();
    expect(result.messageComponent.children[2].content).toEqual({
      message: "Required",
      type: "required",
    });
  });

  it("handles deeply nested paths (3+ levels of children)", () => {
    const inner = [
      {
        path: "messageComponent.children.0.children.1.children.0.href",
        message: "Invalid URL",
        type: "url",
      },
    ] as yup.ValidationError[];

    const result = transformYupErrors(inner);

    expect(result.messageComponent.children[0].children[1].children[0].href).toEqual({
      message: "Invalid URL",
      type: "url",
    });
  });

  it("does not overwrite existing error at sibling path", () => {
    const inner = [
      {
        path: "messageComponent.children.0.content",
        message: "Too long",
        type: "max",
      },
      {
        path: "messageComponent.children.0.label",
        message: "Required",
        type: "required",
      },
    ] as yup.ValidationError[];

    const result = transformYupErrors(inner);

    expect(result.messageComponent.children[0].content).toEqual({
      message: "Too long",
      type: "max",
    });
    expect(result.messageComponent.children[0].label).toEqual({
      message: "Required",
      type: "required",
    });
  });

  it("strips messageComponent prefix for getMessageBuilderFieldErrors compat", () => {
    const inner = [
      {
        path: "messageComponent.children.0.content",
        message: "Required",
        type: "required",
      },
    ] as yup.ValidationError[];

    const result = transformYupErrors(inner);

    // getMessageBuilderFieldErrors traverses errors starting at the root key "messageComponent"
    expect(result).toHaveProperty("messageComponent");
    expect(result.messageComponent.children[0].content.message).toBe("Required");
  });
});
