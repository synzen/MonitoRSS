import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
import { VerifiedEmailSettingsRow } from "./index";

const h = vi.hoisted(() => ({
  enabled: true,
  verifiedEmail: "verified@example.com" as string | undefined,
}));

vi.mock("../../hooks", () => ({
  useIsWorkspacesEnabled: () => ({ enabled: h.enabled }),
}));

vi.mock("@/features/discordUser", () => ({
  useUserMe: () => ({ data: { result: { verifiedEmail: h.verifiedEmail } } }),
}));

// The dialog has its own test; here we only need to know the row renders it, so
// stub it to a marker that does not pull in the verification hooks.
vi.mock("../ChangeVerifiedEmailDialog", () => ({
  ChangeVerifiedEmailDialog: () => null,
}));

const renderRow = () =>
  render(
    <ChakraProvider value={system}>
      <VerifiedEmailSettingsRow onChanged={vi.fn()} />
    </ChakraProvider>,
  );

describe("VerifiedEmailSettingsRow", () => {
  beforeEach(() => {
    h.enabled = true;
    h.verifiedEmail = "verified@example.com";
  });

  it("renders the verified email and a change action for workspace-enabled users", () => {
    renderRow();

    const input = screen.getByLabelText(/verified team email/i) as HTMLInputElement;
    expect(input.value).toBe("verified@example.com");
    expect(screen.getByRole("button", { name: /change email/i })).toBeInTheDocument();
  });

  it("renders nothing for non-workspace users", () => {
    h.enabled = false;
    const { container } = renderRow();

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByLabelText(/verified email/i)).not.toBeInTheDocument();
  });
});
