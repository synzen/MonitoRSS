import "@testing-library/jest-dom";
import { ChakraProvider } from "@chakra-ui/react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { system } from "@/utils/theme";
import { useDiscordAuthStatus } from "@/features/discordUser";
import { LegalNoticeBanner } from "./LegalNoticeBanner";
import { useApplicableLegalNotice } from "./hooks";

vi.mock("@/features/discordUser", () => ({ useDiscordAuthStatus: vi.fn() }));
vi.mock("./hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./hooks")>()),
  useApplicableLegalNotice: vi.fn(),
}));

const renderBanner = () =>
  render(
    <ChakraProvider value={system}>
      <LegalNoticeBanner />
    </ChakraProvider>,
  );

describe("LegalNoticeBanner", () => {
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
            { type: "privacy-policy", url: "https://monitorss.xyz/privacy-policy" },
          ],
        },
      },
    } as never);

    renderBanner();

    expect(screen.getByRole("status", { name: /legal notice/i })).toBeInTheDocument();
    expect(
      screen.getByText(/updates to our terms and privacy policy/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/updated our legal documents/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /terms and conditions/i })).toHaveAttribute(
      "href",
      "https://monitorss.xyz/terms",
    );
    expect(screen.getByRole("link", { name: /privacy policy/i })).toHaveAttribute(
      "target",
      "_blank",
    );
    expect(useApplicableLegalNotice).toHaveBeenCalledWith({ enabled: true });
  });

  it("renders nothing when the API has no applicable notice", () => {
    vi.mocked(useDiscordAuthStatus).mockReturnValue({
      data: { authenticated: true },
    } as never);
    vi.mocked(useApplicableLegalNotice).mockReturnValue({ data: { result: null } } as never);

    const { container } = renderBanner();

    expect(container).toBeEmptyDOMElement();
  });

  it("does not request a notice before authentication is confirmed", () => {
    vi.mocked(useDiscordAuthStatus).mockReturnValue({
      data: { authenticated: false },
    } as never);
    vi.mocked(useApplicableLegalNotice).mockReturnValue({ data: { result: null } } as never);

    renderBanner();

    expect(useApplicableLegalNotice).toHaveBeenCalledWith({ enabled: false });
  });
});
