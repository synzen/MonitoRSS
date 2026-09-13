import "@testing-library/jest-dom";
import { ChakraProvider } from "@chakra-ui/react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { system } from "@/utils/theme";
import { isOfficialMonitoRSSHost } from "./constants";
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
  it("renders as a footer landmark with the product identity", () => {
    mockIsOfficialHost.mockReturnValue(true);
    renderFooter();

    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByText("MonitoRSS")).toBeInTheDocument();
  });

  it("links to the legal documents and support with safe rel", () => {
    mockIsOfficialHost.mockReturnValue(true);
    renderFooter();

    for (const [label, href] of [
      ["Terms", "https://monitorss.xyz/terms"],
      ["Privacy", "https://monitorss.xyz/privacy-policy"],
      ["Cookie Policy", "https://monitorss.xyz/cookie-policy"],
      ["Support", "https://discord.gg/pudv7Rx"],
    ]) {
      const link = screen.getByRole("link", { name: label });
      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("does not render on the full-screen message builder", () => {
    mockIsOfficialHost.mockReturnValue(true);
    renderFooter("/feeds/123/discord-channel-connections/456/message-builder");

    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
  });

  it("does not render on self-hosted instances", () => {
    mockIsOfficialHost.mockReturnValue(false);
    renderFooter();

    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
  });
});
