import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
import { WorkspaceSettings } from "./index";
import { useCurrentWorkspace } from "../../contexts";

const h = vi.hoisted(() => ({
  update: vi.fn(),
  updateError: { current: null as null | { message: string; errorCode?: string } },
  successAlert: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("../../contexts", () => ({
  useCurrentWorkspace: vi.fn(),
}));

// The Reddit connection section has its own test file; stub it so these tests don't
// need its workspace/user queries wired up.
vi.mock("../WorkspaceRedditConnectionSetting", () => ({
  WorkspaceRedditConnectionSetting: ({ workspaceSlug }: { workspaceSlug: string }) => (
    <div>{`reddit-connection-setting:${workspaceSlug}`}</div>
  ),
}));

vi.mock("../../hooks", () => ({
  useUpdateWorkspace: () => ({
    mutateAsync: h.update,
    status: "idle",
    error: h.updateError.current,
    reset: vi.fn(),
  }),
}));

vi.mock("@/contexts/PageAlertContext", () => ({
  usePageAlertContext: () => ({ createSuccessAlert: h.successAlert }),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();

  return { ...actual, useNavigate: () => h.navigate };
});

const asAdmin = () =>
  vi.mocked(useCurrentWorkspace).mockReturnValue({
    id: "workspace-1",
    name: "Acme Marketing",
    slug: "acme-marketing",
    myRole: "admin",
  } as never);

const asOwner = () =>
  vi.mocked(useCurrentWorkspace).mockReturnValue({
    id: "workspace-1",
    name: "Acme Marketing",
    slug: "acme-marketing",
    myRole: "owner",
  } as never);

const renderSettings = () =>
  render(
    <ChakraProvider value={system}>
      <WorkspaceSettings />
    </ChakraProvider>,
  );

describe("WorkspaceSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.updateError.current = null;
  });

  it("lets an admin edit the workspace name and slug", () => {
    asAdmin();

    renderSettings();

    const nameInput = screen.getByRole("textbox", { name: /workspace name/i });
    expect(nameInput).toHaveValue("Acme Marketing");
    expect(nameInput).not.toHaveAttribute("readonly");

    const slugInput = screen.getByRole("textbox", { name: /workspace url/i });
    expect(slugInput).toHaveValue("acme-marketing");
    expect(slugInput).not.toHaveAttribute("readonly");

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("lets an owner edit the workspace name and slug", () => {
    asOwner();

    renderSettings();

    const nameInput = screen.getByRole("textbox", { name: /workspace name/i });
    expect(nameInput).not.toHaveAttribute("readonly");

    const slugInput = screen.getByRole("textbox", { name: /workspace url/i });
    expect(slugInput).not.toHaveAttribute("readonly");

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("disables Save until a field is changed", async () => {
    asAdmin();

    renderSettings();

    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("aria-disabled", "true");

    fireEvent.change(screen.getByRole("textbox", { name: /workspace name/i }), {
      target: { value: "Acme Renamed" },
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save" })).not.toHaveAttribute("aria-disabled"),
    );
  });

  it("saves the new name and raises a success alert", async () => {
    asAdmin();
    h.update.mockResolvedValue({
      result: { id: "workspace-1", name: "Acme Renamed", slug: "acme-marketing" },
    });

    renderSettings();

    fireEvent.change(screen.getByRole("textbox", { name: /workspace name/i }), {
      target: { value: "Acme Renamed" },
    });
    const save = screen.getByRole("button", { name: "Save" });
    await waitFor(() => expect(save).not.toHaveAttribute("aria-disabled"));
    await userEvent.click(save);

    await waitFor(() =>
      expect(h.update).toHaveBeenCalledWith({
        workspaceSlug: "acme-marketing",
        details: { name: "Acme Renamed" },
      }),
    );
    expect(h.successAlert).toHaveBeenCalled();
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it("shows a confirmation dialog when the slug is changed", async () => {
    asAdmin();

    renderSettings();

    fireEvent.change(screen.getByRole("textbox", { name: /workspace url/i }), {
      target: { value: "acme-new-slug" },
    });
    const save = screen.getByRole("button", { name: "Save" });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText(/changing your workspace url/i)).toBeInTheDocument();
  });

  it("navigates to the new slug after confirming a slug change", async () => {
    asAdmin();
    h.update.mockResolvedValue({
      result: { id: "workspace-1", name: "Acme Marketing", slug: "acme-new-slug" },
    });

    renderSettings();

    fireEvent.change(screen.getByRole("textbox", { name: /workspace url/i }), {
      target: { value: "acme-new-slug" },
    });
    const save = screen.getByRole("button", { name: "Save" });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);

    const confirmBtn = await screen.findByRole("button", {
      name: /yes, change url/i,
    });
    fireEvent.click(confirmBtn);

    await waitFor(() =>
      expect(h.update).toHaveBeenCalledWith({
        workspaceSlug: "acme-marketing",
        details: { slug: "acme-new-slug" },
      }),
    );
    expect(h.navigate).toHaveBeenCalledWith("/workspaces/acme-new-slug/settings", {
      replace: true,
    });
  });

  it("surfaces a save error in an inline alert", () => {
    asAdmin();
    h.updateError.current = { message: "Name already taken" };

    renderSettings();

    expect(screen.getByText("Failed to save")).toBeInTheDocument();
    expect(screen.getByText("Name already taken")).toBeInTheDocument();
  });

  it("renders the friendly mapped message for a coded save error, not the raw string", () => {
    asAdmin();
    h.updateError.current = {
      message: "raw server detail",
      errorCode: "WORKSPACE_INSUFFICIENT_ROLE",
    };

    renderSettings();

    expect(screen.getByText("Failed to save")).toBeInTheDocument();
    expect(screen.getByText(/you do not have permission/i)).toBeInTheDocument();
    expect(screen.queryByText(/raw server detail/i)).not.toBeInTheDocument();
  });

  it("does not duplicate a slug-taken failure as a generic alert (shown on the field instead)", () => {
    asAdmin();
    h.updateError.current = { message: "slug taken", errorCode: "WORKSPACE_SLUG_TAKEN" };

    renderSettings();

    expect(screen.queryByText("Failed to save")).not.toBeInTheDocument();
  });

  it("shows the URL preview below the slug field for an admin", () => {
    asAdmin();

    renderSettings();

    expect(screen.getByText(/url preview: \/workspaces\/acme-marketing/i)).toBeInTheDocument();
  });

  it("does not show validation errors on edit/blur, only after Save is clicked", async () => {
    asAdmin();

    renderSettings();

    const nameInput = screen.getByRole("textbox", { name: /workspace name/i });
    // Clearing a required field and blurring must NOT surface an error (mode:
    // onSubmit). waitFor polls, so an async mode:"all" error would fail this.
    fireEvent.change(nameInput, { target: { value: "" } });
    fireEvent.blur(nameInput);

    await waitFor(() => {
      expect(screen.queryByText(/workspace name is required/i)).not.toBeInTheDocument();
    });

    // The error only appears once the user submits.
    const save = screen.getByRole("button", { name: "Save" });
    await waitFor(() => expect(save).not.toHaveAttribute("aria-disabled"));
    await userEvent.click(save);

    expect(await screen.findByText(/workspace name is required/i)).toBeInTheDocument();
    expect(h.update).not.toHaveBeenCalled();
  });
});
