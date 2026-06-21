import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
import { VerifiedEmailSettingsRow } from "./index";

const h = vi.hoisted(() => ({
  enabled: true,
  verifiedEmail: "verified@example.com" as string | undefined,
  workspaces: [] as Array<{ role: string }>,
}));

vi.mock("../../hooks", () => ({
  useIsWorkspacesEnabled: () => ({ enabled: h.enabled }),
  useWorkspaces: () => ({ workspaces: h.workspaces }),
  findOwnedWorkspace: (workspaces?: Array<{ role: string }>) =>
    workspaces?.find((w) => w.role === "owner"),
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
    h.workspaces = [];
  });

  it("mentions billing in the helper text when the user owns a workspace", () => {
    h.workspaces = [{ role: "owner" }];
    renderRow();

    expect(screen.getByText(/billing/i)).toBeInTheDocument();
  });

  it("does not mention billing in the helper text when the user owns no workspace", () => {
    h.workspaces = [{ role: "admin" }];
    renderRow();

    expect(screen.queryByText(/billing/i)).not.toBeInTheDocument();
  });

  it("renders the verified email and a change action for workspace-enabled users", () => {
    renderRow();

    const input = screen.getByLabelText(/verified workspace email/i) as HTMLInputElement;
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
