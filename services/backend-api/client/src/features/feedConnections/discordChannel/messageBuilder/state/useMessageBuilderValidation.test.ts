import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMessageBuilderValidation } from "./useMessageBuilderValidation";
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

describe("useMessageBuilderValidation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty errors for valid state", async () => {
    const root = makeV2Root([makeTextDisplay("td-1", "valid content")]);
    const { result } = renderHook(() => useMessageBuilderValidation(root));

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.errors).toEqual({});
  });

  it("returns empty errors when messageComponent is undefined", async () => {
    const { result } = renderHook(() => useMessageBuilderValidation(undefined));

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.errors).toEqual({});
  });

  it("returns errors for invalid state after debounce", async () => {
    const root = makeV2Root([makeTextDisplay("td-1", "")]);
    const { result } = renderHook(() => useMessageBuilderValidation(root));

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.errors).not.toEqual({});
    expect(result.current.errors.messageComponent).toBeDefined();
  });

  it("clears errors when state becomes valid", async () => {
    const invalidRoot = makeV2Root([makeTextDisplay("td-1", "")]);
    const { result, rerender } = renderHook(({ mc }) => useMessageBuilderValidation(mc), {
      initialProps: { mc: invalidRoot as V2MessageComponentRoot | undefined },
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.errors).not.toEqual({});

    const validRoot = makeV2Root([makeTextDisplay("td-1", "now valid")]);
    rerender({ mc: validRoot });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.errors).toEqual({});
  });

  it("debounces rapid changes (only validates the last state)", async () => {
    const root1 = makeV2Root([makeTextDisplay("td-1", "")]);
    const root2 = makeV2Root([makeTextDisplay("td-1", "valid content")]);

    const { result, rerender } = renderHook(({ mc }) => useMessageBuilderValidation(mc), {
      initialProps: { mc: root1 as V2MessageComponentRoot | undefined },
    });

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    rerender({ mc: root2 });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.errors).toEqual({});
  });

  it("validate() forces immediate validation and returns isValid", async () => {
    vi.useRealTimers();
    const root = makeV2Root([makeTextDisplay("td-1", "valid")]);
    const { result } = renderHook(() => useMessageBuilderValidation(root));

    const isValid = await act(async () => {
      return result.current.validate();
    });

    expect(isValid).toBe(true);
  });

  it("validate() returns false for invalid state", async () => {
    vi.useRealTimers();
    const root = makeV2Root([makeTextDisplay("td-1", "")]);
    const { result } = renderHook(() => useMessageBuilderValidation(root));

    const isValid = await act(async () => {
      return result.current.validate();
    });

    expect(isValid).toBe(false);
    expect(result.current.errors).not.toEqual({});
  });

  it("error shape is nested under messageComponent key", async () => {
    vi.useRealTimers();
    const root = makeV2Root([makeTextDisplay("td-1", "")]);
    const { result } = renderHook(() => useMessageBuilderValidation(root));

    await act(async () => {
      return result.current.validate();
    });

    const mcErrors = result.current.errors.messageComponent;

    expect(mcErrors).toBeDefined();
    // The errors should have a nested structure we can traverse
    // (exact path depends on Yup's recursive lazy resolution)
    expect(typeof mcErrors).toBe("object");
  });
});
