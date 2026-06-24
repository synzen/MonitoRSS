import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { system } from "@/utils/theme";
import { VerifyEmailStep, VerifyEmailFooterHost, VerifyEmailFooterActions } from "./index";

const h = vi.hoisted(() => ({
  sendCode: vi.fn(),
  confirmCode: vi.fn(),
  resetSend: vi.fn(),
  // The confirm error IS read off the hook (react-query owns it); the send error
  // is now owned by the component and captured from the thrown rejection, so the
  // send mock drives failures by rejecting rather than via a hook `error` field.
  confirmError: null as { message: string; errorCode?: string } | null,
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
    error: h.confirmError,
  }),
}));

// Mimics the ApiAdapterError shape the real hooks reject with: an Error carrying
// an `errorCode` the component maps to a friendly message.
const apiError = (errorCode: string, message = "raw server detail") =>
  Object.assign(new Error(message), { errorCode });

// Advances the resend cooldown to zero so the resend button is interactive again.
// The countdown chains one setTimeout per second (each scheduled after the prior
// tick's state update), so the clock is advanced one second at a time to let each
// timer fire and re-render.
const elapseCooldown = async () => {
  for (let i = 0; i < 60; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
  }
};

const renderStep = (props: Partial<React.ComponentProps<typeof VerifyEmailStep>> = {}) =>
  render(
    <ChakraProvider value={system}>
      <VerifyEmailStep onVerified={vi.fn()} {...props} />
    </ChakraProvider>,
  );

// Renders the step under a footer host (as the dialog consumers do), with the
// footer-actions slot in a queryable container so we can assert the primary
// action is published to the host's footer rather than the body.
const renderStepWithFooter = (props: Partial<React.ComponentProps<typeof VerifyEmailStep>> = {}) =>
  render(
    <ChakraProvider value={system}>
      <VerifyEmailFooterHost>
        <VerifyEmailStep onVerified={vi.fn()} {...props} />
        <div data-testid="footer-slot">
          <VerifyEmailFooterActions />
        </div>
      </VerifyEmailFooterHost>
    </ChakraProvider>,
  );

// Drives the component into the "code sent" view so the resend/confirm UI renders.
const reachCodeSentView = async (email = "user@example.com") => {
  h.sendCode.mockResolvedValue(undefined);
  renderStep({ defaultEmail: email });
  fireEvent.click(screen.getByRole("button", { name: /send code/i }));
  await screen.findByRole("button", { name: /resend code/i });
};

describe("VerifyEmailStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    h.confirmError = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resends the code once the cooldown elapses, without requiring the verification field", async () => {
    await reachCodeSentView();
    h.sendCode.mockClear();
    await elapseCooldown();

    fireEvent.click(screen.getByRole("button", { name: /resend code/i }));

    await waitFor(() => expect(h.sendCode).toHaveBeenCalledTimes(1));
    // The empty verification-code field must NOT trip the confirm validation.
    expect(screen.queryByText(/enter the 6-digit code/i)).not.toBeInTheDocument();
    expect(h.confirmCode).not.toHaveBeenCalled();
  });

  it("disables resend during the cooldown and shows a countdown, then re-enables it", async () => {
    await reachCodeSentView();
    h.sendCode.mockClear();

    const resend = screen.getByRole("button", { name: /resend code/i });
    // Counts down (visual) and is inert while the server cooldown is in effect.
    expect(resend).toHaveTextContent(/resend code \(\d+s\)/i);
    expect(resend).toHaveAttribute("aria-disabled", "true");

    // Clicking mid-cooldown must NOT fire another send.
    fireEvent.click(resend);
    expect(h.sendCode).not.toHaveBeenCalled();

    await elapseCooldown();

    expect(resend).toHaveTextContent(/^resend code$/i);
    expect(resend).toHaveAttribute("aria-disabled", "false");
  });

  it("surfaces a send failure on the address step using the friendly error message", async () => {
    // The local send rejects with the server's 429 resend-too-soon code.
    h.sendCode.mockRejectedValue(apiError("EMAIL_VERIFICATION_RESEND_TOO_SOON"));
    renderStep({ defaultEmail: "user@example.com" });

    fireEvent.click(screen.getByRole("button", { name: /^send code$/i }));

    expect(await screen.findByText(/failed to send code/i)).toBeInTheDocument();
    expect(screen.getByText(/please wait a moment before requesting/i)).toBeInTheDocument();
    // The raw server string must NOT leak through.
    expect(screen.queryByText(/raw server detail/i)).not.toBeInTheDocument();
    // The failed send must not advance to the code-entry view.
    expect(screen.queryByLabelText(/verification code/i)).not.toBeInTheDocument();
  });

  it("surfaces a failure from the injected send path (invite flow), not just the local send", async () => {
    // Reproduces the invite-flow bug: sends route through `onSendCode`, whose
    // rejection the component must still surface (the local hook's error is blind
    // to this path). Mirrors send X -> change email -> send X again hitting the
    // server's still-active cooldown.
    const onSendCode = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(apiError("EMAIL_VERIFICATION_RESEND_TOO_SOON"));
    renderStep({ defaultEmail: "invited@example.com", onSendCode });

    fireEvent.click(screen.getByRole("button", { name: /^send code$/i }));
    await screen.findByRole("button", { name: "Resend code" });

    // Change email clears the client cooldown guard so the second send can fire.
    fireEvent.click(screen.getByRole("button", { name: /change email/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^send code$/i }));

    expect(await screen.findByText(/failed to send code/i)).toBeInTheDocument();
    expect(screen.getByText(/please wait a moment before requesting/i)).toBeInTheDocument();
    expect(onSendCode).toHaveBeenCalledTimes(2);
  });

  it("surfaces a confirm failure using the friendly error message", async () => {
    // The confirm error is owned by react-query and read off the hook, so the
    // mocked hook exposes it via `error` (the real mutation populates this on
    // rejection).
    h.confirmError = { message: "raw server detail", errorCode: "EMAIL_VERIFICATION_INVALID_CODE" };
    await reachCodeSentView();

    expect(await screen.findByText(/failed to verify/i)).toBeInTheDocument();
    expect(screen.getByText(/invalid or incorrect verification code/i)).toBeInTheDocument();
    expect(screen.queryByText(/raw server detail/i)).not.toBeInTheDocument();
  });

  it("tells the user how long the verification code is valid", async () => {
    await reachCodeSentView();

    expect(screen.getByText(/the code expires in 10 minutes/i)).toBeInTheDocument();
  });

  it("does not submit the confirm form when changing the email", async () => {
    await reachCodeSentView();

    fireEvent.click(screen.getByRole("button", { name: /change email/i }));

    expect(h.confirmCode).not.toHaveBeenCalled();
    expect(screen.queryByText(/enter the 6-digit code/i)).not.toBeInTheDocument();
    // Back on the email-entry view.
    expect(screen.getByRole("button", { name: /send code/i })).toBeInTheDocument();
  });

  it("shows the empty-code error only when the user submits the confirm form", async () => {
    await reachCodeSentView();

    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));

    expect(await screen.findByText(/enter the 6-digit code/i)).toBeInTheDocument();
    expect(h.confirmCode).not.toHaveBeenCalled();
  });

  describe("footer host", () => {
    // The dialog consumers wrap the step in VerifyEmailFooterHost and render
    // VerifyEmailFooterActions inside their real DialogFooter. The step must
    // publish its Send code / Verify button to that footer slot (not the body),
    // with form/loading wiring intact so the footer button still submits the
    // in-body form.
    it("publishes the Send code button to the footer slot, not the body", () => {
      renderStepWithFooter({ defaultEmail: "user@example.com" });

      const slot = screen.getByTestId("footer-slot");
      expect(slot).toContainElement(screen.getByRole("button", { name: /^send code$/i }));
    });

    it("submits the email form from the footer Send code button", async () => {
      h.sendCode.mockResolvedValue(undefined);
      renderStepWithFooter({ defaultEmail: "user@example.com" });

      fireEvent.click(screen.getByRole("button", { name: /^send code$/i }));

      await waitFor(() =>
        expect(h.sendCode).toHaveBeenCalledWith({ details: { email: "user@example.com" } }),
      );
    });

    it("swaps the footer button to Verify on the code-sent view, keeping resend/change in the body", async () => {
      // Real timers: publishing the button to the footer host is a post-commit
      // effect that triggers a host re-render, so the footer Verify button lands a
      // tick after the body shows the code-sent view. findBy must be able to poll
      // for it, which the suite's global fake timers would freeze.
      vi.useRealTimers();
      h.sendCode.mockResolvedValue(undefined);
      renderStepWithFooter({ defaultEmail: "user@example.com" });
      fireEvent.click(screen.getByRole("button", { name: /^send code$/i }));
      await screen.findByRole("button", { name: "Resend code" });

      const slot = screen.getByTestId("footer-slot");
      expect(slot).toContainElement(await screen.findByRole("button", { name: /^verify$/i }));
      // Send code is gone; Resend / Change email are field-level helpers in the body.
      expect(slot).not.toContainElement(screen.getByRole("button", { name: "Resend code" }));
      expect(slot).not.toContainElement(screen.getByRole("button", { name: /change email/i }));
    });

    it("submits the confirm form from the footer Verify button", async () => {
      // Real timers here: the assertion polls for the confirm mock, and waitFor's
      // polling never advances under the suite's global fake timers.
      vi.useRealTimers();
      h.sendCode.mockResolvedValue(undefined);
      h.confirmCode.mockResolvedValue(undefined);
      renderStepWithFooter({ defaultEmail: "user@example.com" });
      fireEvent.click(screen.getByRole("button", { name: /^send code$/i }));
      await screen.findByRole("button", { name: "Resend code" });

      fireEvent.change(screen.getByLabelText(/verification code/i), {
        target: { value: "123456" },
      });
      fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));

      await waitFor(() =>
        expect(h.confirmCode).toHaveBeenCalledWith({
          details: { email: "user@example.com", code: "123456" },
        }),
      );
    });
  });

  it("separates the resend and change-email actions without a middot glyph", async () => {
    await reachCodeSentView();

    // The middot was a non-standard separator between two buttons; it should be gone.
    expect(screen.queryByText("·")).not.toBeInTheDocument();
    // Both actions remain available as distinct buttons.
    expect(screen.getByRole("button", { name: "Resend code" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /change email/i })).toBeInTheDocument();
  });
});
