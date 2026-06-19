import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
import { CreateWorkspaceDialog } from "./index";
import { useUserMe } from "@/features/discordUser";
import ApiAdapterError from "@/utils/ApiAdapterError";

const h = vi.hoisted(() => ({
  create: vi.fn(),
  send: vi.fn(),
  confirm: vi.fn(),
  navigate: vi.fn(),
  createError: { current: null as null | { message: string; errorCode?: string } },
  paddleConfigured: { current: true },
}));

vi.mock("@/features/subscriptionProducts", () => ({
  usePaddleContext: () => ({ isConfigured: h.paddleConfigured.current }),
}));

vi.mock("@/features/discordUser", () => ({
  useUserMe: vi.fn(),
}));

vi.mock("../../hooks", () => ({
  useCreateWorkspace: () => ({
    mutateAsync: h.create,
    status: "idle",
    error: h.createError.current,
    reset: vi.fn(),
  }),
  useSendEmailVerification: () => ({
    mutateAsync: h.send,
    status: "idle",
    error: null,
    reset: vi.fn(),
  }),
  useConfirmEmailVerification: () => ({
    mutateAsync: h.confirm,
    status: "idle",
    error: null,
    reset: vi.fn(),
  }),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();

  return { ...actual, useNavigate: () => h.navigate };
});

const mockUnverified = () =>
  vi.mocked(useUserMe).mockReturnValue({
    data: {
      result: { email: "discord@example.com", verifiedEmail: undefined },
    },
  } as never);

const mockVerified = () =>
  vi.mocked(useUserMe).mockReturnValue({
    data: {
      result: {
        email: "discord@example.com",
        verifiedEmail: "owned@example.com",
      },
    },
  } as never);

const renderDialog = (onClose = vi.fn()) => {
  render(
    <ChakraProvider value={system}>
      <CreateWorkspaceDialog isOpen onClose={onClose} />
    </ChakraProvider>,
  );

  return onClose;
};

describe("CreateWorkspaceDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.createError.current = null;
    h.paddleConfigured.current = true;
  });

  it("discloses the workspace plan and free personal feeds before email verification", () => {
    mockUnverified();

    renderDialog();

    expect(screen.getByText(/creating a workspace is free/i)).toBeInTheDocument();
    expect(screen.getByText(/needs a separate workspace plan/i)).toBeInTheDocument();
    expect(
      screen.getByText(/your personal feeds stay free and aren't affected/i),
    ).toBeInTheDocument();
  });

  it("keeps the disclosure visible on the create form step", () => {
    mockVerified();

    renderDialog();

    expect(screen.getByText(/creating a workspace is free/i)).toBeInTheDocument();
  });

  it("shows only the value explainer when billing is not configured", () => {
    h.paddleConfigured.current = false;
    mockVerified();

    renderDialog();

    expect(
      screen.getByText(/a workspace is a shared space where you and others manage feeds together/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/workspace plan/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/free/i)).not.toBeInTheDocument();
  });

  it("requires email verification before the name form when no verified email exists", () => {
    mockUnverified();

    renderDialog();

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send code/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create workspace/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/workspace name/i)).not.toBeInTheDocument();
  });

  it("pre-fills the Discord email in the verification step", () => {
    mockUnverified();

    renderDialog();

    expect(screen.getByLabelText(/email address/i)).toHaveValue("discord@example.com");
  });

  it("shows the name and slug form once a verified email exists", () => {
    mockVerified();

    renderDialog();

    expect(screen.getByLabelText(/workspace name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/workspace url/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create workspace/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send code/i })).not.toBeInTheDocument();
  });

  it("auto-fills the slug from the workspace name while pristine", async () => {
    mockVerified();
    renderDialog();

    fireEvent.change(screen.getByLabelText(/workspace name/i), {
      target: { value: "My Awesome Workspace" },
    });

    await waitFor(() =>
      expect(screen.getByLabelText(/workspace url/i)).toHaveValue("my-awesome-workspace"),
    );
  });

  it("stops auto-filling once the slug field is manually edited", async () => {
    mockVerified();
    renderDialog();

    const slugInput = screen.getByLabelText(/workspace url/i);
    fireEvent.focus(slugInput);
    fireEvent.change(slugInput, { target: { value: "my-custom-slug" } });

    fireEvent.change(screen.getByLabelText(/workspace name/i), {
      target: { value: "Other Name" },
    });

    await waitFor(() =>
      // slug should not change to "other-name"; stays "my-custom-slug"
      expect(slugInput).toHaveValue("my-custom-slug"),
    );
  });

  it("creates the workspace and navigates to its workspace using the slug", async () => {
    mockVerified();
    h.create.mockResolvedValue({ result: { id: "workspace-x", slug: "my-workspace" } });
    const onClose = renderDialog();

    fireEvent.change(screen.getByLabelText(/workspace name/i), {
      target: { value: "My Workspace" },
    });
    await waitFor(() =>
      expect(screen.getByLabelText(/workspace url/i)).toHaveValue("my-workspace"),
    );
    fireEvent.click(screen.getByRole("button", { name: /create workspace/i }));

    await waitFor(() =>
      expect(h.create).toHaveBeenCalledWith({
        details: { name: "My Workspace", slug: "my-workspace" },
      }),
    );
    expect(h.navigate).toHaveBeenCalledWith("/workspaces/my-workspace/feeds");
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the dialog open when creation fails", async () => {
    mockVerified();
    h.create.mockRejectedValue(new Error("boom"));
    const onClose = renderDialog();

    fireEvent.change(screen.getByLabelText(/workspace name/i), {
      target: { value: "My Workspace" },
    });
    await waitFor(() =>
      expect(screen.getByLabelText(/workspace url/i)).toHaveValue("my-workspace"),
    );
    fireEvent.click(screen.getByRole("button", { name: /create workspace/i }));

    await waitFor(() => expect(h.create).toHaveBeenCalled());
    expect(h.navigate).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("sets a slug field error on WORKSPACE_SLUG_TAKEN", async () => {
    mockVerified();
    h.create.mockRejectedValue(
      new ApiAdapterError("slug taken", { errorCode: "WORKSPACE_SLUG_TAKEN" }),
    );
    renderDialog();

    fireEvent.change(screen.getByLabelText(/workspace name/i), {
      target: { value: "My Workspace" },
    });
    await waitFor(() =>
      expect(screen.getByLabelText(/workspace url/i)).toHaveValue("my-workspace"),
    );
    fireEvent.click(screen.getByRole("button", { name: /create workspace/i }));

    expect(await screen.findByText(/this url is already taken/i)).toBeInTheDocument();
  });

  it("surfaces a create error in an inline alert", () => {
    mockVerified();
    h.createError.current = { message: "Workspace name already taken" };

    renderDialog();

    expect(screen.getByText("Failed to create workspace")).toBeInTheDocument();
    expect(screen.getByText("Workspace name already taken")).toBeInTheDocument();
  });

  it("renders the friendly mapped message for a coded create error, not the raw string", () => {
    mockVerified();
    h.createError.current = { message: "raw server detail", errorCode: "EMAIL_NOT_VERIFIED" };

    renderDialog();

    expect(screen.getByText("Failed to create workspace")).toBeInTheDocument();
    expect(screen.getByText(/a verified email is required/i)).toBeInTheDocument();
    expect(screen.queryByText(/raw server detail/i)).not.toBeInTheDocument();
  });

  it("explains the never-activated workspace cap when creation is rejected for it", () => {
    mockVerified();
    h.createError.current = {
      message: "raw server detail",
      errorCode: "WORKSPACE_NEVER_ACTIVATED_EXISTS",
    };

    renderDialog();

    expect(screen.getByText("Failed to create workspace")).toBeInTheDocument();
    expect(screen.getByText(/hasn't been activated/i)).toBeInTheDocument();
    expect(screen.queryByText(/raw server detail/i)).not.toBeInTheDocument();
  });

  it("does not duplicate a slug-taken failure as a generic alert (shown on the field instead)", () => {
    // The slug code is surfaced on the slug field; the generic alert must suppress
    // it to avoid showing the same failure twice.
    mockVerified();
    h.createError.current = { message: "slug taken", errorCode: "WORKSPACE_SLUG_TAKEN" };

    renderDialog();

    expect(screen.queryByText("Failed to create workspace")).not.toBeInTheDocument();
  });

  it("blocks submission and shows a validation error for an empty name", async () => {
    mockVerified();
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: /create workspace/i }));

    expect(await screen.findByText("Workspace name is required")).toBeInTheDocument();
    expect(h.create).not.toHaveBeenCalled();
  });

  it("blocks a reserved slug client-side without calling the API", async () => {
    mockVerified();
    renderDialog();

    const slugInput = screen.getByLabelText(/workspace url/i);
    fireEvent.focus(slugInput);
    fireEvent.change(slugInput, { target: { value: "settings" } });
    fireEvent.change(screen.getByLabelText(/workspace name/i), {
      target: { value: "My Workspace" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create workspace/i }));

    expect(await screen.findByText(/this url is reserved/i)).toBeInTheDocument();
    expect(h.create).not.toHaveBeenCalled();
  });

  it("surfaces a reserved-slug error returned by the API on the slug field", async () => {
    mockVerified();
    h.create.mockRejectedValue(
      new ApiAdapterError("reserved", { errorCode: "WORKSPACE_SLUG_RESERVED" }),
    );
    renderDialog();

    fireEvent.change(screen.getByLabelText(/workspace name/i), {
      target: { value: "My Workspace" },
    });
    await waitFor(() =>
      expect(screen.getByLabelText(/workspace url/i)).toHaveValue("my-workspace"),
    );
    fireEvent.click(screen.getByRole("button", { name: /create workspace/i }));

    expect(await screen.findByText(/this url is reserved/i)).toBeInTheDocument();
  });

  it("does not validate the name field on blur before a submission attempt", async () => {
    mockVerified();
    renderDialog();

    const nameInput = screen.getByLabelText(/workspace name/i);
    fireEvent.focus(nameInput);
    fireEvent.blur(nameInput);

    await waitFor(() => {
      expect(screen.queryByText("Workspace name is required")).not.toBeInTheDocument();
    });
  });

  it("announces verification success so the name form is reachable", async () => {
    mockUnverified();
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: /send code/i }));
    fireEvent.change(await screen.findByLabelText(/verification code/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    expect(await screen.findByText(/your email is verified/i)).toBeInTheDocument();
    await waitFor(() => expect(h.confirm).toHaveBeenCalled());
  });
});
