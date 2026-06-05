import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi } from "vitest";
import { FiSend } from "react-icons/fi";
import { system } from "@/utils/theme";
import { SafeLoadingIconButton } from "./index";

const renderButton = (ui: React.ReactElement) =>
  render(<ChakraProvider value={system}>{ui}</ChakraProvider>);

describe("SafeLoadingIconButton", () => {
  it("does not natively disable while loading, so focus is retained", () => {
    renderButton(
      <SafeLoadingIconButton aria-label="Send" loading>
        <FiSend />
      </SafeLoadingIconButton>,
    );

    const button = screen.getByRole("button", { name: "Send" });

    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");

    button.focus();
    expect(button).toHaveFocus();
  });

  it("guards activation while loading", async () => {
    const onClick = vi.fn();
    renderButton(
      <SafeLoadingIconButton aria-label="Send" loading onClick={onClick}>
        <FiSend />
      </SafeLoadingIconButton>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("activates normally when not loading", async () => {
    const onClick = vi.fn();
    renderButton(
      <SafeLoadingIconButton aria-label="Send" onClick={onClick}>
        <FiSend />
      </SafeLoadingIconButton>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("expresses a non-loading disabled button as aria-disabled, keeping it focusable", () => {
    renderButton(
      <SafeLoadingIconButton aria-label="Send" disabled>
        <FiSend />
      </SafeLoadingIconButton>,
    );

    const button = screen.getByRole("button", { name: "Send" });

    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toHaveAttribute("aria-busy");

    button.focus();
    expect(button).toHaveFocus();
  });

  it("guards activation while disabled (not loading)", async () => {
    const onClick = vi.fn();
    renderButton(
      <SafeLoadingIconButton aria-label="Send" disabled onClick={onClick}>
        <FiSend />
      </SafeLoadingIconButton>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(onClick).not.toHaveBeenCalled();
  });
});
