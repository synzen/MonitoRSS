import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
import { ChangeVerifiedEmailDialog } from "./index";

const h = vi.hoisted(() => ({
  sendCode: vi.fn(),
  confirmCode: vi.fn(),
  resetSend: vi.fn(),
}));

vi.mock("../../hooks", () => ({
  useSendEmailVerification: () => ({
    mutateAsync: h.sendCode,
    status: "idle",
    reset: h.resetSend,
  }),
  useConfirmEmailVerification: () => ({
    mutateAsync: h.confirmCode,
    status: "idle",
    error: null,
  }),
}));

const renderDialog = (
  props: Partial<React.ComponentProps<typeof ChangeVerifiedEmailDialog>> = {},
) =>
  render(
    <ChakraProvider value={system}>
      <ChangeVerifiedEmailDialog
        isOpen
        onClose={vi.fn()}
        onChanged={vi.fn()}
        currentEmail="old@example.com"
        {...props}
      />
    </ChakraProvider>,
  );

describe("ChangeVerifiedEmailDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.sendCode.mockResolvedValue(undefined);
    h.confirmCode.mockResolvedValue(undefined);
  });

  it("shows the current verified email as context in the intro", () => {
    renderDialog({ currentEmail: "current@example.com" });

    expect(screen.getByText(/current@example.com/)).toBeInTheDocument();
  });

  it("starts with an empty email field rather than pre-filling the current address", () => {
    renderDialog({ currentEmail: "current@example.com" });

    const input = screen.getByLabelText(/email address/i) as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("calls onChanged and onClose after the new address is verified", async () => {
    const onChanged = vi.fn();
    const onClose = vi.fn();
    renderDialog({ onChanged, onClose });

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "new@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send code/i }));

    const codeInput = await screen.findByLabelText(/verification code/i);
    fireEvent.change(codeInput, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(h.confirmCode).toHaveBeenCalledWith({
      details: { email: "new@example.com", code: "123456" },
    });
  });
});
