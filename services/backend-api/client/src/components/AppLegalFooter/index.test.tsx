import "@testing-library/jest-dom";
import { ChakraProvider } from "@chakra-ui/react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { system } from "@/utils/theme";
import { isOfficialMonitoRSSHost, LEGAL_IDENTITY_EFFECTIVE_AT } from "./constants";
import { AppLegalFooter } from "./index";

vi.mock("./constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./constants")>();
  return {
    ...actual,
    isOfficialMonitoRSSHost: vi.fn(),
  };
});

const mockIsOfficialHost = vi.mocked(isOfficialMonitoRSSHost);

const renderFooter = (initialPath = "/feeds") =>
  render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AppLegalFooter />
      </MemoryRouter>
    </ChakraProvider>,
  );

describe("AppLegalFooter", () => {
  beforeEach(() => {
    mockIsOfficialHost.mockReturnValue(true);
    vi.useFakeTimers({
      now: new Date(LEGAL_IDENTITY_EFFECTIVE_AT.getTime() + 24 * 60 * 60 * 1000),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders as a footer landmark with the product and owner identity", () => {
    renderFooter();

    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByText("MonitoRSS")).toBeInTheDocument();
    expect(screen.getByText(`© ${new Date().getFullYear()} Relayvale LLC`)).toBeInTheDocument();
  });

  it("links to the updated legal documents and support with safe rel", () => {
    renderFooter();

    for (const [label, href] of [
      ["Terms", "https://monitorss.xyz/legal/terms"],
      ["Privacy", "https://monitorss.xyz/legal/privacy"],
      ["Cookie Policy", "https://monitorss.xyz/legal/cookie"],
      ["Support", "https://discord.gg/pudv7Rx"],
    ]) {
      const link = screen.getByRole("link", { name: label });
      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("does not render on the full-screen message builder", () => {
    renderFooter("/feeds/123/discord-channel-connections/456/message-builder");

    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
  });

  it("does not render on self-hosted instances", () => {
    mockIsOfficialHost.mockReturnValue(false);
    renderFooter();

    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
  });

  it("does not render before the updated documents take effect", () => {
    vi.setSystemTime(new Date(LEGAL_IDENTITY_EFFECTIVE_AT.getTime() - 1));

    renderFooter();

    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
  });
});
