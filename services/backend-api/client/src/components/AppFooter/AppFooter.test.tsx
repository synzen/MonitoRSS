import { render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { system } from "@/utils/theme";
import { AppFooter } from "./index";

const renderFooter = (initialPath = "/feeds") =>
  render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AppFooter />
      </MemoryRouter>
    </ChakraProvider>,
  );

describe("AppFooter", () => {
  it("links to the privacy policy in a new tab with safe rel", () => {
    renderFooter();

    const link = screen.getByRole("link", { name: "Privacy Policy" });

    expect(link).toHaveAttribute("href", "https://monitorss.xyz/privacy-policy");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("links to the terms in a new tab with safe rel", () => {
    renderFooter();

    const link = screen.getByRole("link", { name: "Terms" });

    expect(link).toHaveAttribute("href", "https://monitorss.xyz/terms");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders as a footer landmark", () => {
    renderFooter();

    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("does not render on the full-screen message builder", () => {
    renderFooter("/feeds/123/discord-channel-connections/456/message-builder");

    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
  });
});
