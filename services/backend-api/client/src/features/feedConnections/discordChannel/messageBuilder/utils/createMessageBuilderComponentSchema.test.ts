import { describe, it, expect } from "vitest";
import createMessageBuilderComponentSchema from "./createMessageBuilderComponentSchema";
import { ComponentType, TextDisplayComponent, V2MessageComponentRoot } from "../types";

const schema = createMessageBuilderComponentSchema();

const makeTextDisplay = (id: string, length: number): TextDisplayComponent => ({
  id,
  name: id,
  type: ComponentType.V2TextDisplay,
  content: "a".repeat(length),
  children: [],
});

const makeRoot = (children: V2MessageComponentRoot["children"]): V2MessageComponentRoot => ({
  id: "root",
  name: "root",
  type: ComponentType.V2Root,
  children,
});

describe("createMessageBuilderComponentSchema", () => {
  it("rejects total Text Display content over 4000 characters", async () => {
    const root = makeRoot([
      makeTextDisplay("td-1", 1500),
      makeTextDisplay("td-2", 1500),
      makeTextDisplay("td-3", 1501),
    ]);

    await expect(schema.validate(root)).rejects.toMatchObject({
      errors: [expect.stringContaining("4501")],
    });
  });

  it("accepts exactly 4000 total Text Display characters", async () => {
    const root = makeRoot([makeTextDisplay("td-1", 2000), makeTextDisplay("td-2", 2000)]);

    await expect(schema.validate(root)).resolves.toBeDefined();
  });

  it("counts Text Displays nested inside containers", async () => {
    const root = makeRoot([
      {
        id: "container-1",
        name: "container-1",
        type: ComponentType.V2Container,
        children: [makeTextDisplay("td-1", 2000), makeTextDisplay("td-2", 2000)],
      },
      makeTextDisplay("td-3", 1),
    ]);

    await expect(schema.validate(root)).rejects.toMatchObject({
      errors: [expect.stringContaining("4001")],
    });
  });
});
