import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMessageBuilderDirty } from "./useMessageBuilderDirty";
import { ComponentType, V2MessageComponentRoot, TextDisplayComponent } from "../types";

function makeTextDisplay(id: string, content = "hello"): TextDisplayComponent {
  return { id, name: "Text Display", type: ComponentType.V2TextDisplay, content };
}

function makeV2Root(children: any[] = []): V2MessageComponentRoot {
  return {
    id: "root-1",
    name: "Discord Components V2",
    type: ComponentType.V2Root,
    children,
  };
}

describe("useMessageBuilderDirty", () => {
  it("is not dirty when current matches server state", () => {
    const root = makeV2Root([makeTextDisplay("td-1")]);
    const server = makeV2Root([makeTextDisplay("td-1")]);
    const { result } = renderHook(() => useMessageBuilderDirty(root, server));

    expect(result.current.isDirty).toBe(false);
  });

  it("is dirty when current differs from server state", () => {
    const current = makeV2Root([makeTextDisplay("td-1", "edited")]);
    const server = makeV2Root([makeTextDisplay("td-1", "original")]);
    const { result } = renderHook(() => useMessageBuilderDirty(current, server));

    expect(result.current.isDirty).toBe(true);
  });

  it("is not dirty when both are undefined", () => {
    const { result } = renderHook(() => useMessageBuilderDirty(undefined, undefined));

    expect(result.current.isDirty).toBe(false);
  });

  it("is dirty when current exists but server is undefined", () => {
    const current = makeV2Root([makeTextDisplay("td-1")]);
    const { result } = renderHook(() => useMessageBuilderDirty(current, undefined));

    expect(result.current.isDirty).toBe(true);
  });

  it("becomes not dirty when server state catches up", () => {
    const edited = makeV2Root([makeTextDisplay("td-1", "edited")]);
    const original = makeV2Root([makeTextDisplay("td-1", "original")]);

    const { result, rerender } = renderHook(
      ({ current, server }) => useMessageBuilderDirty(current, server),
      { initialProps: { current: edited, server: original } },
    );

    expect(result.current.isDirty).toBe(true);

    rerender({ current: edited, server: edited });

    expect(result.current.isDirty).toBe(false);
  });

  it("ignores key ordering differences", () => {
    const current = makeV2Root([makeTextDisplay("td-1")]);
    const serverData = JSON.parse(JSON.stringify(current));
    const reordered = Object.keys(serverData)
      .reverse()
      .reduce((acc: any, key: string) => {
        acc[key] = serverData[key];

        return acc;
      }, {}) as V2MessageComponentRoot;
    const { result } = renderHook(() => useMessageBuilderDirty(current, reordered));

    expect(result.current.isDirty).toBe(false);
  });

  it("treats undefined and null as equal", () => {
    const current: V2MessageComponentRoot = { ...makeV2Root(), formatTables: undefined };
    const server: V2MessageComponentRoot = { ...makeV2Root(), formatTables: undefined };
    (server as any).formatTables = null;
    const { result } = renderHook(() => useMessageBuilderDirty(current, server));

    expect(result.current.isDirty).toBe(false);
  });
});
