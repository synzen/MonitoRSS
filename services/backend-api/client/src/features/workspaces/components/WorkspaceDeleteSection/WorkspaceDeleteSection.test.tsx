import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
import { WorkspaceDeleteSection } from "./index";
import { useCurrentWorkspace } from "../../contexts";

const h = vi.hoisted(() => ({
  deleteWorkspace: vi.fn(),
  deleteReset: vi.fn(),
  deleteError: { current: null as null | { message: string; errorCode?: string } },
  navigate: vi.fn(),
  paddleConfigured: { current: false },
}));

vi.mock("../../contexts", () => ({
  useCurrentWorkspace: vi.fn(),
}));

vi.mock("../../hooks", () => ({
  useDeleteWorkspace: () => ({
    mutateAsync: h.deleteWorkspace,
    status: "idle",
    error: h.deleteError.current,
    reset: h.deleteReset,
  }),
}));

vi.mock("@/features/subscriptionProducts", () => ({
  usePaddleContext: () => ({ isConfigured: h.paddleConfigured.current }),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();

  return { ...actual, useNavigate: () => h.navigate };
});

const asRole = (myRole: "owner" | "admin") =>
  vi.mocked(useCurrentWorkspace).mockReturnValue({
    id: "workspace-1",
    name: "Acme Marketing",
    slug: "acme-marketing",
    myRole,
  } as never);

const renderSection = () =>
  render(
    <ChakraProvider value={system}>
      <WorkspaceDeleteSection />
    </ChakraProvider>,
  );

const openDeleteDialog = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Delete workspace" }));

  return screen.findByRole("alertdialog");
};

describe("WorkspaceDeleteSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.deleteError.current = null;
    h.paddleConfigured.current = false;
  });

  it("shows the delete section to owners", () => {
    asRole("owner");

    renderSection();

    expect(screen.getByRole("button", { name: "Delete workspace" })).toBeInTheDocument();
  });

  it("renders nothing for admins", () => {
    asRole("admin");

    const { container } = renderSection();

    expect(container).toBeEmptyDOMElement();
  });

  it("keeps the confirm button disabled until the workspace name is typed exactly", async () => {
    asRole("owner");

    renderSection();

    const dialog = await openDeleteDialog();
    const confirmButton = within(dialog).getByRole("button", { name: "Delete workspace" });
    expect(confirmButton).toHaveAttribute("aria-disabled", "true");

    const phraseInput = within(dialog).getByLabelText(/type "acme marketing" to confirm/i);
    fireEvent.change(phraseInput, { target: { value: "Acme" } });
    expect(confirmButton).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(confirmButton);
    expect(h.deleteWorkspace).not.toHaveBeenCalled();

    fireEvent.change(phraseInput, { target: { value: "Acme Marketing" } });
    expect(confirmButton).not.toHaveAttribute("aria-disabled");
  });

  it("deletes the workspace and navigates home with a persistent alert", async () => {
    asRole("owner");
    h.deleteWorkspace.mockResolvedValue(undefined);

    renderSection();

    const dialog = await openDeleteDialog();
    fireEvent.change(within(dialog).getByLabelText(/type "acme marketing" to confirm/i), {
      target: { value: "Acme Marketing" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete workspace" }));

    await waitFor(() => expect(h.deleteWorkspace).toHaveBeenCalledWith("acme-marketing"));
    expect(h.navigate).toHaveBeenCalledWith(
      "/feeds",
      expect.objectContaining({
        state: expect.objectContaining({
          alertTitle: "Workspace deleted",
          alertDescription: expect.stringContaining("Acme Marketing"),
        }),
      }),
    );
  });

  it("only mentions subscription cancellation when billing is configured", async () => {
    asRole("owner");
    h.paddleConfigured.current = true;

    renderSection();

    const dialog = await openDeleteDialog();
    expect(
      within(dialog).getByText(/any active subscription will be cancelled/i),
    ).toBeInTheDocument();
  });

  it("omits the subscription sentence on self-host (no billing configured)", async () => {
    asRole("owner");

    renderSection();

    const dialog = await openDeleteDialog();
    expect(
      within(dialog).queryByText(/any active subscription will be cancelled/i),
    ).not.toBeInTheDocument();
  });

  it("keeps the dialog open and shows the error when deletion fails", async () => {
    asRole("owner");
    h.deleteWorkspace.mockRejectedValue(new Error("boom"));
    h.deleteError.current = { message: "boom" };

    renderSection();

    const dialog = await openDeleteDialog();
    fireEvent.change(within(dialog).getByLabelText(/type "acme marketing" to confirm/i), {
      target: { value: "Acme Marketing" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete workspace" }));

    expect(await within(dialog).findByText("boom")).toBeInTheDocument();
    expect(h.navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("renders the friendly mapped message for a coded deletion error, not the raw string", async () => {
    asRole("owner");
    h.deleteWorkspace.mockRejectedValue(new Error("raw server detail"));
    h.deleteError.current = {
      message: "raw server detail",
      errorCode: "WORKSPACE_INSUFFICIENT_ROLE",
    };

    renderSection();

    const dialog = await openDeleteDialog();
    fireEvent.change(within(dialog).getByLabelText(/type "acme marketing" to confirm/i), {
      target: { value: "Acme Marketing" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete workspace" }));

    expect(await within(dialog).findByText(/you do not have permission/i)).toBeInTheDocument();
    expect(within(dialog).queryByText(/raw server detail/i)).not.toBeInTheDocument();
  });

  it("resets the mutation state when the dialog is closed", async () => {
    asRole("owner");

    renderSection();

    const dialog = await openDeleteDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(h.deleteReset).toHaveBeenCalled());
  });
});
