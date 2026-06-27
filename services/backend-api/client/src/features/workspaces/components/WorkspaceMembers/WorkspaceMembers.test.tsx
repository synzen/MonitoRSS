import "@testing-library/jest-dom";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
import { WorkspaceMembers } from "./index";

const h = vi.hoisted(() => ({
  workspace: {
    current: {
      id: "ws-1",
      name: "Acme",
      slug: "acme",
      myRole: "owner" as "owner" | "admin",
      subscription: null as null | { status: string },
    },
  },
  members: {
    current: [] as Array<{ userId: string; role: string; discordUserId: string }>,
  },
  invites: {
    current: [] as Array<{
      id: string;
      email: string;
      role: string;
      invitedByUserId: string;
      createdAt: string;
    }>,
  },
  selfUserId: { current: "self" },
  createInvite: vi.fn(),
  // `leave` needs per-test control: the modal-error-reset test sets an error and
  // asserts the mutation is reset on close; the success test asserts the toast.
  leave: vi.fn(),
  leaveReset: vi.fn(),
  leaveError: { current: null as null | { message: string; errorCode?: string } },
  removeMember: vi.fn(),
  removeReset: vi.fn(),
  removeError: { current: null as null | { message: string; errorCode?: string } },
  resend: vi.fn(),
  resendReset: vi.fn(),
  resendError: { current: null as null | { message: string; errorCode?: string } },
  transfer: vi.fn(),
  transferReset: vi.fn(),
  transferError: { current: null as null | { message: string; errorCode?: string } },
  createSuccessAlert: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return { ...actual, useNavigate: () => h.navigate };
});

vi.mock("../../contexts", () => ({
  useCurrentWorkspace: () => h.workspace.current,
}));

vi.mock("@/features/discordUser", () => ({
  useUserMe: () => ({ data: { result: { id: h.selfUserId.current } } }),
  // Resolve the snowflake to a readable username so rows show a name, not a raw id.
  DiscordUsername: ({ userId }: { userId: string }) => <span>{`user-${userId}`}</span>,
  // MemberRow resolves the same username for its per-row button labels, so the
  // accessible name matches the visible username rather than the raw snowflake.
  useDiscordUser: ({ userId }: { userId: string }) => ({
    data: { result: { username: `user-${userId}` } },
    status: "success",
    error: null,
    isFetching: false,
  }),
}));

vi.mock("@/contexts/PageAlertContext", () => ({
  usePageAlertContext: () => ({ createSuccessAlert: h.createSuccessAlert }),
}));

vi.mock("../../hooks", () => ({
  useWorkspaceMembers: () => ({
    members: h.members.current,
    status: "success",
    error: null,
    refetch: vi.fn(),
  }),
  useWorkspaceInvitesForWorkspace: () => ({
    invites: h.invites.current,
    status: "success",
    error: null,
    refetch: vi.fn(),
  }),
  useCreateWorkspaceInvite: () => ({ mutateAsync: h.createInvite, error: null }),
  useResendWorkspaceInvite: () => ({
    mutateAsync: h.resend,
    error: h.resendError.current,
    reset: h.resendReset,
  }),
  useRevokeWorkspaceInvite: () => ({ mutateAsync: vi.fn(), error: null, reset: vi.fn() }),
  useRemoveWorkspaceMember: () => ({
    mutateAsync: h.removeMember,
    error: h.removeError.current,
    reset: h.removeReset,
  }),
  useLeaveWorkspace: () => ({
    mutateAsync: h.leave,
    error: h.leaveError.current,
    reset: h.leaveReset,
  }),
  useTransferWorkspaceOwnership: () => ({
    mutateAsync: h.transfer,
    error: h.transferError.current,
    reset: h.transferReset,
  }),
}));

const renderView = () =>
  render(
    <ChakraProvider value={system}>
      <MemoryRouter>
        <WorkspaceMembers />
      </MemoryRouter>
    </ChakraProvider>,
  );

describe("WorkspaceMembers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.workspace.current = {
      id: "ws-1",
      name: "Acme",
      slug: "acme",
      myRole: "owner",
      subscription: null,
    };
    h.selfUserId.current = "self";
    h.members.current = [
      { userId: "self", role: "owner", discordUserId: "1111" },
      { userId: "other", role: "admin", discordUserId: "2222" },
    ];
    h.invites.current = [];
    h.leaveError.current = null;
    h.removeError.current = null;
    h.resendError.current = null;
    h.transferError.current = null;
    h.resend.mockResolvedValue(undefined);
    h.leave.mockResolvedValue(undefined);
    h.removeMember.mockResolvedValue(undefined);
    h.transfer.mockResolvedValue(undefined);
  });

  const pendingInvite = (overrides?: Partial<(typeof h.invites.current)[number]>) => ({
    id: "inv-1",
    email: "pending@example.com",
    role: "admin",
    invitedByUserId: "self",
    createdAt: new Date().toISOString(),
    ...overrides,
  });

  it("lists current members with their roles", () => {
    renderView();

    const region = screen.getByRole("region", { name: "Members" });
    const owner = within(region)
      .getAllByRole("listitem")
      .find((el) => within(el).queryByText(/owner/i)) as HTMLElement;
    const admin = within(region)
      .getAllByRole("listitem")
      .find((el) => within(el).queryByText(/admin/i)) as HTMLElement;

    expect(within(owner).getByText(/owner/i)).toBeInTheDocument();
    expect(within(admin).getByText(/admin/i)).toBeInTheDocument();
  });

  it("renders members by resolved username, not the raw Discord snowflake", () => {
    renderView();

    const region = screen.getByRole("region", { name: "Members" });
    expect(within(region).getByText("user-2222")).toBeInTheDocument();
    expect(within(region).queryByText("2222")).not.toBeInTheDocument();
  });

  it("lists pending invitations with inviter and creation time", () => {
    h.invites.current = [
      {
        id: "inv-1",
        email: "pending@example.com",
        role: "admin",
        invitedByUserId: "self",
        createdAt: new Date().toISOString(),
      },
    ];

    renderView();

    const region = screen.getByRole("region", { name: "Pending invitations" });
    const item = within(region).getByRole("listitem");
    expect(within(item).getByText("pending@example.com")).toBeInTheDocument();
    expect(within(item).getByText(/invited by you/i)).toBeInTheDocument();
    expect(within(item).getByText(/ago|few seconds/i)).toBeInTheDocument();
  });

  it("shows a Remove control on other members for an owner", () => {
    renderView();

    const region = screen.getByRole("region", { name: "Members" });
    const otherRow = within(region)
      .getAllByRole("listitem")
      .find((el) => within(el).queryByText(/admin/i)) as HTMLElement;
    expect(within(otherRow).getByRole("button", { name: /^remove/i })).toBeInTheDocument();
  });

  it("names the Remove control with the member's username so rows are distinguishable", () => {
    renderView();

    // Without a per-row name every Remove button reads identically as "Remove".
    // The accessible name must carry the resolved username of the target member.
    expect(
      screen.getByRole("button", { name: /remove user-2222 from the workspace/i }),
    ).toBeInTheDocument();
  });

  it("hides the Remove-other control from an admin but keeps Leave", () => {
    h.workspace.current = {
      id: "ws-1",
      name: "Acme",
      slug: "acme",
      myRole: "admin",
      subscription: null,
    };

    renderView();

    const region = screen.getByRole("region", { name: "Members" });
    expect(within(region).queryByRole("button", { name: /^remove/i })).not.toBeInTheDocument();
    expect(within(region).getByRole("button", { name: /leave/i })).toBeInTheDocument();
  });

  it("does not show an invite-email validation error on blur, only after Send invite", async () => {
    renderView();

    const emailInput = screen.getByRole("textbox", { name: /invite by email/i });
    fireEvent.focus(emailInput);
    fireEvent.change(emailInput, { target: { value: "not-an-email" } });
    fireEvent.blur(emailInput);

    // The error must NOT surface from typing/blur alone (mode: onSubmit). waitFor
    // polls so an async mode:"all" validation appearing mid-window would fail this.
    await waitFor(() => {
      expect(screen.queryByText(/enter a valid email address/i)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /send invite/i }));

    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument();
    expect(h.createInvite).not.toHaveBeenCalled();
  });

  it("clears a stale leave error by resetting the mutation when the modal is closed", async () => {
    const user = userEvent.setup();
    // Self is the only member so the row shows "Leave workspace". The hook reports a
    // prior failure via `error` (react-query's error channel, mirrored here).
    h.members.current = [{ userId: "self", role: "owner", discordUserId: "1111" }];
    h.leaveError.current = { message: "Cannot leave" };

    renderView();

    await user.click(screen.getByRole("button", { name: /leave workspace/i }));
    const dialog = await screen.findByRole("alertdialog");
    // The stale error from the prior attempt is shown inside the dialog.
    expect(within(dialog).getByText(/cannot leave/i)).toBeInTheDocument();

    // Closing the modal must reset the mutation so the stale error doesn't persist
    // into the next open.
    await user.click(within(dialog).getByRole("button", { name: /cancel/i }));

    expect(h.leaveReset).toHaveBeenCalled();
  });

  it("shows the friendly mapped message for a coded leave error, not the raw server string", async () => {
    const user = userEvent.setup();
    h.members.current = [{ userId: "self", role: "owner", discordUserId: "1111" }];
    // A coded failure (the last owner can't leave) must render the friendly text.
    h.leaveError.current = {
      message: "raw server detail",
      errorCode: "CANNOT_REMOVE_LAST_OWNER",
    };

    renderView();

    await user.click(screen.getByRole("button", { name: /leave workspace/i }));
    const dialog = await screen.findByRole("alertdialog");

    expect(
      within(dialog).getByText(/a workspace must have at least one owner/i),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText(/raw server detail/i)).not.toBeInTheDocument();
  });

  it("labels each pending-invite control with the target email so they are distinguishable", () => {
    h.invites.current = [
      pendingInvite({ id: "inv-1", email: "a@example.com" }),
      pendingInvite({ id: "inv-2", email: "b@example.com" }),
    ];

    renderView();

    // Two pending invites means two Resend and two Revoke buttons; without the
    // per-row email in the accessible name they would all read identically.
    expect(
      screen.getByRole("button", { name: "Resend invitation to a@example.com" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Resend invitation to b@example.com" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Revoke invitation to a@example.com" }),
    ).toBeInTheDocument();
  });

  it("resends an invitation and surfaces a success alert on confirm", async () => {
    const user = userEvent.setup();
    h.invites.current = [pendingInvite({ email: "pending@example.com" })];

    renderView();

    await user.click(
      screen.getByRole("button", { name: "Resend invitation to pending@example.com" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: /resend invitation/i }));

    await waitFor(() =>
      expect(h.resend).toHaveBeenCalledWith({ workspaceSlug: "acme", inviteId: "inv-1" }),
    );
    expect(h.createSuccessAlert).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Invitation resent" }),
    );
  });

  it("shows the friendly cooldown message in the modal and fires no success alert on a 429", async () => {
    const user = userEvent.setup();
    h.invites.current = [pendingInvite({ email: "pending@example.com" })];
    // A 429 from the per-invite cooldown rejects the mutation; the hook then exposes
    // the coded error (mirrored here via `error`), which the modal must render as the
    // friendly mapped message rather than a raw string, and no success alert may fire.
    h.resend.mockRejectedValue({ errorCode: "WORKSPACE_INVITE_RESEND_TOO_SOON" });
    h.resendError.current = {
      message: "raw 429 detail",
      errorCode: "WORKSPACE_INVITE_RESEND_TOO_SOON",
    };

    renderView();

    await user.click(
      screen.getByRole("button", { name: "Resend invitation to pending@example.com" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: /resend invitation/i }));

    await waitFor(() => expect(h.resend).toHaveBeenCalled());
    expect(h.createSuccessAlert).not.toHaveBeenCalled();
    // The modal stays open and shows the friendly cooldown copy, not the raw string.
    expect(
      within(await screen.findByRole("alertdialog")).getByText(
        /please wait a moment before resending/i,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/raw 429 detail/i)).not.toBeInTheDocument();
  });

  it("confirms a successful leave by navigating to feeds with a persistent alert", async () => {
    const user = userEvent.setup();
    // Self is the only member so the row shows "Leave workspace". Leaving navigates
    // away, so the confirmation is carried in navigation state and raised as a
    // persistent (dismissable) alert on the feeds page — a page-scoped alert
    // raised here would unmount before it could be seen.
    h.members.current = [{ userId: "self", role: "owner", discordUserId: "1111" }];

    renderView();

    await user.click(screen.getByRole("button", { name: /leave workspace/i }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: /leave workspace/i }));

    await waitFor(() => expect(h.leave).toHaveBeenCalledWith("acme"));
    expect(h.navigate).toHaveBeenCalledWith(
      "/feeds",
      expect.objectContaining({
        state: expect.objectContaining({
          alertTitle: "Left workspace",
          alertDescription: expect.stringContaining("Acme"),
        }),
      }),
    );
  });

  it("confirms removing another member with a page success alert", async () => {
    const user = userEvent.setup();

    renderView();

    const region = screen.getByRole("region", { name: "Members" });
    const otherRow = within(region)
      .getAllByRole("listitem")
      .find((el) => within(el).queryByText(/admin/i)) as HTMLElement;
    await user.click(within(otherRow).getByRole("button", { name: /^remove/i }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: /remove member/i }));

    await waitFor(() =>
      expect(h.removeMember).toHaveBeenCalledWith({ workspaceSlug: "acme", userId: "other" }),
    );
    expect(h.createSuccessAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Member removed",
        // The sentence body (not just the title) confirms the outcome and names
        // the workspace; it is what a screen reader announces as the message.
        description: expect.stringContaining("Acme"),
      }),
    );
  });

  it("shows a Make owner control on an admin member for an owner", () => {
    renderView();

    const region = screen.getByRole("region", { name: "Members" });
    const adminRow = within(region)
      .getAllByRole("listitem")
      .find((el) => within(el).queryByText(/admin/i)) as HTMLElement;
    expect(
      within(adminRow).getByRole("button", { name: /make .* the owner/i }),
    ).toBeInTheDocument();
  });

  it("names Make owner with the username, never the raw Discord snowflake", () => {
    renderView();

    // The visible label is "Make owner"; the accessible name must add the
    // resolved username for row context, not the unreadable snowflake "2222".
    expect(screen.getByRole("button", { name: "Make user-2222 the owner" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /make 2222 the owner/i })).not.toBeInTheDocument();
  });

  it("hides Make owner from a non-owner admin", () => {
    h.workspace.current = {
      id: "ws-1",
      name: "Acme",
      slug: "acme",
      myRole: "admin",
      subscription: null,
    };

    renderView();

    const region = screen.getByRole("region", { name: "Members" });
    expect(
      within(region).queryByRole("button", { name: /make .* the owner/i }),
    ).not.toBeInTheDocument();
  });

  it("does not offer Make owner on another owner's row", () => {
    // A second owner exists; ownership is single-owner so there is no one to
    // transfer to among owners. Only admins are valid targets.
    h.members.current = [
      { userId: "self", role: "owner", discordUserId: "1111" },
      { userId: "other", role: "owner", discordUserId: "2222" },
    ];

    renderView();

    const region = screen.getByRole("region", { name: "Members" });
    expect(
      within(region).queryByRole("button", { name: /make .* the owner/i }),
    ).not.toBeInTheDocument();
  });

  it("transfers ownership after typing the workspace name, then surfaces a success alert", async () => {
    const user = userEvent.setup();

    renderView();

    const region = screen.getByRole("region", { name: "Members" });
    const adminRow = within(region)
      .getAllByRole("listitem")
      .find((el) => within(el).queryByText(/admin/i)) as HTMLElement;
    await user.click(within(adminRow).getByRole("button", { name: /make .* the owner/i }));

    const dialog = await screen.findByRole("alertdialog");
    const confirmButton = within(dialog).getByRole("button", { name: /transfer ownership/i });
    // The confirmation phrase gates the action: it stays disabled until the
    // exact workspace name is typed. SafeLoadingButton disables via aria-disabled
    // rather than the native attribute.
    expect(confirmButton).toHaveAttribute("aria-disabled", "true");

    // A wrong phrase must NOT enable the action: the gate compares the exact
    // team name, so any other text leaves the destructive confirm disabled.
    const phraseInput = within(dialog).getByRole("textbox");
    await user.type(phraseInput, "not the workspace name");
    expect(confirmButton).toHaveAttribute("aria-disabled", "true");

    await user.clear(phraseInput);
    await user.type(phraseInput, "Acme");
    expect(confirmButton).not.toHaveAttribute("aria-disabled", "true");
    await user.click(confirmButton);

    await waitFor(() =>
      expect(h.transfer).toHaveBeenCalledWith({ workspaceSlug: "acme", userId: "other" }),
    );
    expect(h.createSuccessAlert).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Ownership transferred" }),
    );
  });

  it("warns about the billing tail only when the workspace has a subscription", async () => {
    const user = userEvent.setup();
    h.workspace.current = {
      id: "ws-1",
      name: "Acme",
      slug: "acme",
      myRole: "owner",
      subscription: { status: "active" },
    };

    renderView();

    const region = screen.getByRole("region", { name: "Members" });
    const adminRow = within(region)
      .getAllByRole("listitem")
      .find((el) => within(el).queryByText(/admin/i)) as HTMLElement;
    await user.click(within(adminRow).getByRole("button", { name: /make .* the owner/i }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/keep billing your payment method/i)).toBeInTheDocument();
  });

  it("omits the billing-tail warning when the workspace has no subscription", async () => {
    const user = userEvent.setup();

    renderView();

    const region = screen.getByRole("region", { name: "Members" });
    const adminRow = within(region)
      .getAllByRole("listitem")
      .find((el) => within(el).queryByText(/admin/i)) as HTMLElement;
    await user.click(within(adminRow).getByRole("button", { name: /make .* the owner/i }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).queryByText(/keep billing your payment method/i)).not.toBeInTheDocument();
  });

  it("shows the friendly mapped message for a coded transfer error", async () => {
    const user = userEvent.setup();
    h.transfer.mockRejectedValue({ errorCode: "WORKSPACE_TRANSFER_TARGET_INVALID" });
    h.transferError.current = {
      message: "raw server detail",
      errorCode: "WORKSPACE_TRANSFER_TARGET_INVALID",
    };

    renderView();

    const region = screen.getByRole("region", { name: "Members" });
    const adminRow = within(region)
      .getAllByRole("listitem")
      .find((el) => within(el).queryByText(/admin/i)) as HTMLElement;
    await user.click(within(adminRow).getByRole("button", { name: /make .* the owner/i }));

    const dialog = await screen.findByRole("alertdialog");
    await user.type(within(dialog).getByRole("textbox"), "Acme");
    await user.click(within(dialog).getByRole("button", { name: /transfer ownership/i }));

    await waitFor(() => expect(h.transfer).toHaveBeenCalled());
    expect(h.createSuccessAlert).not.toHaveBeenCalled();
    expect(
      within(await screen.findByRole("alertdialog")).getByText(
        /ownership can only be transferred to an existing admin/i,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/raw server detail/i)).not.toBeInTheDocument();
  });

  it("shows the error in the dialog and fires no success alert when removing a member fails", async () => {
    const user = userEvent.setup();
    // The remove mutation rejects; the hook then exposes the error (mirrored here
    // via `error`), which the dialog must render, and no success alert may fire.
    h.removeMember.mockRejectedValue({ message: "Cannot remove member" });
    h.removeError.current = { message: "Cannot remove member" };

    renderView();

    const region = screen.getByRole("region", { name: "Members" });
    const otherRow = within(region)
      .getAllByRole("listitem")
      .find((el) => within(el).queryByText(/admin/i)) as HTMLElement;
    await user.click(within(otherRow).getByRole("button", { name: /^remove/i }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: /remove member/i }));

    await waitFor(() => expect(h.removeMember).toHaveBeenCalled());
    expect(h.createSuccessAlert).not.toHaveBeenCalled();
    // The modal stays open and shows the failure message.
    expect(
      within(await screen.findByRole("alertdialog")).getByText(/cannot remove member/i),
    ).toBeInTheDocument();
  });
});
