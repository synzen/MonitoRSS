import "@testing-library/jest-dom";
import { render, screen, act, waitFor } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useContext } from "react";
import { system } from "@/utils/theme";
import { useUserMe } from "@/features/discordUser";

const h = vi.hoisted(() => {
  // The provider reads the client token at module load; without it the Paddle
  // event callback is never registered. Set before the module is imported
  // (vitest mirrors process.env into import.meta.env; the client tsconfig has
  // no node types, hence the cast).
  (
    globalThis as unknown as { process: { env: Record<string, string> } }
  ).process.env.VITE_PADDLE_CLIENT_TOKEN = "test-client-token";

  return {
    eventCallback: undefined as undefined | ((event: { name: string; data?: unknown }) => void),
  };
});

vi.mock("@paddle/paddle-js", () => ({
  initializePaddle: vi.fn(async (opts: { eventCallback: (event: never) => void }) => {
    h.eventCallback = opts.eventCallback as typeof h.eventCallback;

    return {
      Checkout: { open: vi.fn(), close: vi.fn(), updateItems: vi.fn() },
    };
  }),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/features/discordUser", () => ({
  useUserMe: vi.fn(() => ({
    data: {
      result: {
        id: "user-1",
        email: "user@example.com",
        subscription: { product: { key: "free" } },
      },
    },
  })),
  useDiscordUserMe: vi.fn(() => ({ refetch: vi.fn() })),
}));

// eslint-disable-next-line import/first
import { PaddleContext, PaddleContextProvider } from "./PaddleContext";

const renderProvider = (child = <div />) =>
  render(
    <ChakraProvider value={system}>
      <PaddleContextProvider>{child}</PaddleContextProvider>
    </ChakraProvider>,
  );

const IsConfiguredProbe = () => {
  const { isConfigured } = useContext(PaddleContext);

  return <span data-testid="is-configured">{String(isConfigured)}</span>;
};

const mockUserMe = (overrides: { enableBilling?: boolean }) => {
  vi.mocked(useUserMe).mockReturnValue({
    data: {
      result: {
        id: "user-1",
        email: "user@example.com",
        subscription: { product: { key: "free" } },
        ...overrides,
      },
    },
  } as never);
};

const emitCheckoutCompleted = (customData: Record<string, string>) =>
  act(() => {
    h.eventCallback?.({
      name: "checkout.completed",
      data: { custom_data: customData },
    });
  });

describe("PaddleContextProvider isConfigured", () => {
  beforeEach(() => {
    h.eventCallback = undefined;
    vi.clearAllMocks();
  });

  it("is false when billing is disabled even though a client token is present", async () => {
    // The exact self-host leak: a leftover VITE_PADDLE_CLIENT_TOKEN must not
    // surface billing UI when the instance reports billing off.
    mockUserMe({ enableBilling: false });
    renderProvider(<IsConfiguredProbe />);

    await waitFor(() =>
      expect(screen.getByTestId("is-configured")).toHaveTextContent("false"),
    );
  });

  it("is true when billing is enabled and a client token is present", async () => {
    mockUserMe({ enableBilling: true });
    renderProvider(<IsConfiguredProbe />);

    await waitFor(() =>
      expect(screen.getByTestId("is-configured")).toHaveTextContent("true"),
    );
  });
});

describe("PaddleContextProvider checkout.completed routing", () => {
  beforeEach(() => {
    h.eventCallback = undefined;
    vi.clearAllMocks();
  });

  it("does not poll for a personal subscription when the completed checkout was for a workspace", async () => {
    renderProvider();
    await waitFor(() => expect(h.eventCallback).toBeDefined());

    // A workspace checkout's completion is confirmed on the workspace Billing
    // page; the personal "Provisioning benefits..." overlay polls the USER's
    // record, which never changes for a workspace purchase.
    emitCheckoutCompleted({ userId: "user-1", workspaceId: "workspace-1" });

    expect(screen.queryByText(/provisioning benefits/i)).not.toBeInTheDocument();
  });

  it("polls for the personal subscription when the completed checkout was personal", async () => {
    renderProvider();
    await waitFor(() => expect(h.eventCallback).toBeDefined());

    emitCheckoutCompleted({ userId: "user-1" });

    expect(await screen.findByText(/provisioning benefits/i)).toBeInTheDocument();
  });
});
