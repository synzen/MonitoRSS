import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
import { ProductKey } from "@/constants";
import { DeleteAccountSection } from "./index";

interface TestUser {
  verifiedEmail?: string;
  enableBilling: boolean;
  isOnPatreon: boolean;
  subscription: {
    product: { key: string };
    status: string;
    cancellationDate: string | null;
  };
}

const h = vi.hoisted(() => ({
  sendCode: vi.fn(),
  deleteAccount: vi.fn(),
  deleteError: null as { errorCode?: string; message: string } | null,
  user: null as unknown,
}));

vi.mock("../../hooks", () => ({
  useSendAccountDeletionCode: () => ({
    mutateAsync: h.sendCode,
    status: "idle",
    error: null,
    reset: vi.fn(),
  }),
  useDeleteMyAccount: () => ({
    mutateAsync: h.deleteAccount,
    status: "idle",
    error: h.deleteError,
    reset: vi.fn(),
  }),
}));

vi.mock("../../../discordUser", () => ({
  useUserMe: () => ({ data: { result: h.user } }),
}));

vi.mock("../../../auth", () => ({
  getLogout: vi.fn().mockResolvedValue(undefined),
}));

const buildUser = (overrides: Partial<TestUser> = {}): TestUser => ({
  verifiedEmail: "verified@example.com",
  enableBilling: true,
  isOnPatreon: false,
  subscription: {
    product: { key: ProductKey.Free },
    status: "ACTIVE",
    cancellationDate: null,
  },
  ...overrides,
});

const renderSection = () =>
  render(
    <ChakraProvider value={system}>
      <DeleteAccountSection />
    </ChakraProvider>,
  );

const openDialog = () => {
  fireEvent.click(screen.getByRole("button", { name: /^delete account$/i }));
};

describe("DeleteAccountSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.sendCode.mockResolvedValue(undefined);
    h.deleteAccount.mockResolvedValue(undefined);
    h.deleteError = null;
    h.user = buildUser();
  });

  it("lists what will be erased and offers to send a code when nothing blocks deletion", () => {
    renderSection();
    openDialog();

    expect(screen.getByText(/permanently erases/i)).toBeInTheDocument();
    expect(screen.getByText(/personal feeds/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send confirmation code/i })).toBeInTheDocument();
  });

  it("explains the verified-email requirement instead of offering to send a code", () => {
    h.user = buildUser({ verifiedEmail: undefined });
    renderSection();
    openDialog();

    expect(screen.getByText(/verified email required/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /send confirmation code/i }),
    ).not.toBeInTheDocument();
  });

  it("explains the active-subscription blocker instead of offering to send a code", () => {
    h.user = buildUser({
      subscription: {
        product: { key: ProductKey.Tier2 },
        status: "ACTIVE",
        cancellationDate: null,
      },
    });
    renderSection();
    openDialog();

    expect(screen.getByText(/cancel it in the billing section/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /send confirmation code/i }),
    ).not.toBeInTheDocument();
  });

  it("does not block on a subscription that is already scheduled to cancel", () => {
    h.user = buildUser({
      subscription: {
        product: { key: ProductKey.Tier2 },
        status: "ACTIVE",
        cancellationDate: new Date().toISOString(),
      },
    });
    renderSection();
    openDialog();

    expect(screen.getByRole("button", { name: /send confirmation code/i })).toBeInTheDocument();
  });

  it("does not block when billing is disabled on the instance", () => {
    h.user = buildUser({
      enableBilling: false,
      subscription: {
        product: { key: ProductKey.Tier2 },
        status: "ACTIVE",
        cancellationDate: null,
      },
    });
    renderSection();
    openDialog();

    expect(screen.getByRole("button", { name: /send confirmation code/i })).toBeInTheDocument();
  });

  it("warns Patreon pledgers that deletion does not cancel their pledge", () => {
    h.user = buildUser({ isOnPatreon: true });
    renderSection();
    openDialog();

    expect(screen.getByText(/does not cancel your patreon pledge/i)).toBeInTheDocument();
  });

  it("walks the full flow: send code, confirm with the code, then show success", async () => {
    renderSection();
    openDialog();

    fireEvent.click(screen.getByRole("button", { name: /send confirmation code/i }));

    const codeInput = await screen.findByLabelText(/confirmation code/i);
    expect(h.sendCode).toHaveBeenCalledTimes(1);

    fireEvent.change(codeInput, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /permanently delete account/i }));

    await waitFor(() =>
      expect(h.deleteAccount).toHaveBeenCalledWith({ details: { code: "123456" } }),
    );
    expect(
      await screen.findByText(/your account and its data have been deleted/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /return to homepage/i })).toBeInTheDocument();
  });

  it("rejects a malformed code without calling the API", async () => {
    renderSection();
    openDialog();

    fireEvent.click(screen.getByRole("button", { name: /send confirmation code/i }));
    const codeInput = await screen.findByLabelText(/confirmation code/i);

    fireEvent.change(codeInput, { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: /permanently delete account/i }));

    expect(await screen.findByText(/enter the 6-digit code/i)).toBeInTheDocument();
    expect(h.deleteAccount).not.toHaveBeenCalled();
  });

  it("surfaces the mapped sole-owner message when deletion is refused", async () => {
    renderSection();
    openDialog();

    fireEvent.click(screen.getByRole("button", { name: /send confirmation code/i }));
    const codeInput = await screen.findByLabelText(/confirmation code/i);

    h.deleteError = {
      errorCode: "ACCOUNT_DELETE_SOLE_WORKSPACE_OWNER",
      message: "raw server message",
    };
    h.deleteAccount.mockRejectedValue(h.deleteError);

    fireEvent.change(codeInput, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /permanently delete account/i }));

    expect(await screen.findByText(/only owner of one or more workspaces/i)).toBeInTheDocument();
  });
});
