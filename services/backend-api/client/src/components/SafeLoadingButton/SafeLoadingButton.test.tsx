import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi } from "vitest";
import { system } from "@/utils/theme";
import { SafeLoadingButton } from "./index";

const renderButton = (ui: React.ReactElement) =>
  render(<ChakraProvider value={system}>{ui}</ChakraProvider>);

describe("SafeLoadingButton", () => {
  it("does not natively disable while loading, so focus is retained", async () => {
    renderButton(
      <SafeLoadingButton loading>
        <span>Save</span>
      </SafeLoadingButton>,
    );

    const button = screen.getByRole("button");

    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");

    button.focus();
    expect(button).toHaveFocus();
  });

  it("guards activation while loading", async () => {
    const onClick = vi.fn();
    renderButton(
      <SafeLoadingButton loading onClick={onClick}>
        <span>Save</span>
      </SafeLoadingButton>,
    );

    await userEvent.click(screen.getByRole("button"));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("activates normally when not loading", async () => {
    const onClick = vi.fn();
    renderButton(
      <SafeLoadingButton onClick={onClick}>
        <span>Save</span>
      </SafeLoadingButton>,
    );

    await userEvent.click(screen.getByRole("button"));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("expresses a non-loading disabled button as aria-disabled, keeping it focusable", () => {
    renderButton(
      <SafeLoadingButton disabled>
        <span>Save</span>
      </SafeLoadingButton>,
    );

    const button = screen.getByRole("button");

    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toHaveAttribute("aria-busy");

    button.focus();
    expect(button).toHaveFocus();
  });

  it("guards activation while disabled (not loading)", async () => {
    const onClick = vi.fn();
    renderButton(
      <SafeLoadingButton disabled onClick={onClick}>
        <span>Save</span>
      </SafeLoadingButton>,
    );

    await userEvent.click(screen.getByRole("button"));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("blocks enclosing form submission while disabled (not loading)", async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    renderButton(
      <form onSubmit={onSubmit}>
        <input aria-label="name" />
        <SafeLoadingButton type="submit" disabled>
          <span>Save</span>
        </SafeLoadingButton>
      </form>,
    );

    await userEvent.type(screen.getByLabelText("name"), "{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("preserves a caller-supplied aria-disabled when not loading", () => {
    renderButton(
      <SafeLoadingButton aria-disabled>
        <span>Save</span>
      </SafeLoadingButton>,
    );

    const button = screen.getByRole("button");

    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toHaveAttribute("aria-busy");
  });

  it("blocks enclosing form submission while loading", async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    renderButton(
      <form onSubmit={onSubmit}>
        <input aria-label="name" />
        <SafeLoadingButton type="submit" loading>
          <span>Save</span>
        </SafeLoadingButton>
      </form>,
    );

    await userEvent.type(screen.getByLabelText("name"), "{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("allows enclosing form submission when not loading", async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    renderButton(
      <form onSubmit={onSubmit}>
        <input aria-label="name" />
        <SafeLoadingButton type="submit">
          <span>Save</span>
        </SafeLoadingButton>
      </form>,
    );

    await userEvent.type(screen.getByLabelText("name"), "{Enter}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
