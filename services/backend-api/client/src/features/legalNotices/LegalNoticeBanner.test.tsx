import "@testing-library/jest-dom";
import { ChakraProvider } from "@chakra-ui/react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { system } from "@/utils/theme";
import { useDiscordAuthStatus } from "@/features/discordUser";
import { LegalNoticeBanner } from "./LegalNoticeBanner";
import { useApplicableLegalNotice, useDismissLegalNotice } from "./hooks";

vi.mock("@/features/discordUser", () => ({ useDiscordAuthStatus: vi.fn() }));
vi.mock("./hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./hooks")>()),
  useApplicableLegalNotice: vi.fn(),
  useDismissLegalNotice: vi.fn(),
}));

const dismissNotice = vi.fn();

const renderBanner = () =>
  render(
    <ChakraProvider value={system}>
      <LegalNoticeBanner />
    </ChakraProvider>,
  );

describe("LegalNoticeBanner", () => {
  beforeEach(() => {
    dismissNotice.mockReset();
    vi.mocked(useDismissLegalNotice).mockReturnValue({
      mutate: dismissNotice,
      status: "idle",
    } as never);
  });

  it("renders an accessible notice region with all configured document links", () => {
    vi.mocked(useDiscordAuthStatus).mockReturnValue({
      data: { authenticated: true },
    } as never);
    vi.mocked(useApplicableLegalNotice).mockReturnValue({
      data: {
        result: {
          version: "2026-09-01",
          summary: "We updated our legal documents.",
          documents: [
            { type: "terms", url: "https://monitorss.xyz/terms" },
            {
              type: "privacy-policy",
              url: "https://monitorss.xyz/privacy-policy",
            },
          ],
        },
      },
    } as never);

    renderBanner();

    expect(screen.getByRole("status", { name: /legal notice/i })).toBeInTheDocument();
    expect(screen.getByText(/updates to our terms and privacy policy/i)).toBeInTheDocument();
    expect(screen.getByText(/updated our legal documents/i)).toBeInTheDocument();
    expect(screen.getByText(/please review our/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "Terms and Conditions (opens in a new tab)",
      }),
    ).toHaveAttribute("href", "https://monitorss.xyz/terms");
    expect(
      screen.getByRole("link", { name: "Privacy Policy (opens in a new tab)" }),
    ).toHaveAttribute("target", "_blank");
    expect(useApplicableLegalNotice).toHaveBeenCalledWith({ enabled: true });
  });

  it("dismisses the displayed notice", async () => {
    const user = userEvent.setup();
    vi.mocked(useDiscordAuthStatus).mockReturnValue({
      data: { authenticated: true },
    } as never);
    vi.mocked(useApplicableLegalNotice).mockReturnValue({
      data: {
        result: {
          version: "2026-09-01",
          summary: "We updated our legal documents.",
          documents: [{ type: "terms", url: "https://monitorss.xyz/terms" }],
        },
      },
    } as never);

    renderBanner();
    await user.click(
      screen.getByRole("button", {
        name: /dismiss legal notice/i,
      }),
    );

    expect(dismissNotice).toHaveBeenCalledWith("2026-09-01");
  });

  it("does not record dismissal when opening a document link", async () => {
    const user = userEvent.setup();
    vi.mocked(useDiscordAuthStatus).mockReturnValue({
      data: { authenticated: true },
    } as never);
    vi.mocked(useApplicableLegalNotice).mockReturnValue({
      data: {
        result: {
          version: "2026-09-01",
          summary: "We updated our legal documents.",
          documents: [
            { type: "terms", url: "https://monitorss.xyz/terms" },
            {
              type: "privacy-policy",
              url: "https://monitorss.xyz/privacy-policy",
            },
          ],
        },
      },
    } as never);

    renderBanner();

    // Block default anchor navigation so the test env never fetches the
    // external URL; React click handlers still run.
    const suppressNavigation = (event: MouseEvent) => event.preventDefault();
    window.addEventListener("click", suppressNavigation, { capture: true });

    try {
      await user.click(
        screen.getByRole("link", {
          name: "Terms and Conditions (opens in a new tab)",
        }),
      );
      await user.click(
        screen.getByRole("link", { name: "Privacy Policy (opens in a new tab)" }),
      );
    } finally {
      window.removeEventListener("click", suppressNavigation, { capture: true });
    }

    expect(dismissNotice).not.toHaveBeenCalled();
    expect(screen.getByRole("status", { name: /legal notice/i })).toBeInTheDocument();
  });

  it("keeps the banner visible when saving dismissal fails", () => {
    vi.mocked(useDiscordAuthStatus).mockReturnValue({
      data: { authenticated: true },
    } as never);
    vi.mocked(useApplicableLegalNotice).mockReturnValue({
      data: {
        result: {
          version: "2026-09-01",
          summary: "We updated our legal documents.",
          documents: [{ type: "terms", url: "https://monitorss.xyz/terms" }],
        },
      },
    } as never);
    vi.mocked(useDismissLegalNotice).mockReturnValue({
      mutate: dismissNotice,
      status: "error",
      error: new Error("Network error"),
    } as never);

    renderBanner();

    expect(screen.getByRole("status", { name: /legal notice/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dismiss legal notice/i })).toBeInTheDocument();
  });

  it("identifies a notice as upcoming before it becomes effective", () => {
    vi.mocked(useDiscordAuthStatus).mockReturnValue({
      data: { authenticated: true },
    } as never);
    vi.mocked(useApplicableLegalNotice).mockReturnValue({
      data: {
        result: {
          version: "2026-09-01",
          phase: "upcoming",
          summary: "An update is planned.",
          documents: [{ type: "terms", url: "https://monitorss.xyz/terms" }],
        },
      },
    } as never);

    renderBanner();

    expect(screen.getByText(/upcoming updates to our terms/i)).toBeInTheDocument();
  });

  it("renders nothing when the API has no applicable notice", () => {
    vi.mocked(useDiscordAuthStatus).mockReturnValue({
      data: { authenticated: true },
    } as never);
    vi.mocked(useApplicableLegalNotice).mockReturnValue({
      data: { result: null },
    } as never);

    const { container } = renderBanner();

    expect(container).toBeEmptyDOMElement();
  });

  it("does not request a notice before authentication is confirmed", () => {
    vi.mocked(useDiscordAuthStatus).mockReturnValue({
      data: { authenticated: false },
    } as never);
    vi.mocked(useApplicableLegalNotice).mockReturnValue({
      data: { result: null },
    } as never);

    renderBanner();

    expect(useApplicableLegalNotice).toHaveBeenCalledWith({ enabled: false });
  });
});
