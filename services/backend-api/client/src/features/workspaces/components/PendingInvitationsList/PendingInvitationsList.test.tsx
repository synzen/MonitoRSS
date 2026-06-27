import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
import { PendingInvitationsList } from "./index";

const h = vi.hoisted(() => ({
  accept: vi.fn(),
  decline: vi.fn(),
  invites: {
    current: [] as Array<{
      id: string;
      email: string;
      role: string;
      workspaceName: string;
      invitedByUserId: string;
      createdAt: string;
    }>,
  },
  status: { current: "success" as "loading" | "success" | "error" },
  acceptStatus: { current: "idle" as "idle" | "loading" | "success" | "error" },
  declineStatus: { current: "idle" as "idle" | "loading" | "success" | "error" },
}));

vi.mock("../../hooks", () => ({
  useMyWorkspaceInvites: () => ({
    invites: h.invites.current,
    status: h.status.current,
    error: null,
    refetch: vi.fn(),
  }),
  useAcceptWorkspaceInvite: () => ({
    mutateAsync: h.accept,
    status: h.acceptStatus.current,
    error: null,
  }),
  useDeclineWorkspaceInvite: () => ({
    mutateAsync: h.decline,
    status: h.declineStatus.current,
    error: null,
  }),
}));

// True when `first` appears before `second` in document order. Avoids the bitwise
// compareDocumentPosition mask (no-bitwise) by walking the rendered tree.
const precedesInDom = (first: Element, second: Element): boolean => {
  const all = Array.from(document.querySelectorAll("*"));

  return all.indexOf(first) < all.indexOf(second);
};

const invite = (id: string, workspaceName: string) => ({
  id,
  email: "me@example.com",
  role: "admin",
  workspaceName,
  invitedByUserId: "inviter",
  createdAt: new Date().toISOString(),
});

const renderList = () =>
  render(
    <ChakraProvider value={system}>
      <PendingInvitationsList />
    </ChakraProvider>,
  );

describe("PendingInvitationsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.status.current = "success";
    h.invites.current = [];
    h.acceptStatus.current = "idle";
    h.declineStatus.current = "idle";
  });

  it("renders nothing when there are no pending invitations", () => {
    const { container } = renderList();
    expect(container).toBeEmptyDOMElement();
  });

  it("lists every pending invitation under a labelled region", () => {
    h.invites.current = [invite("a", "Workspace A"), invite("b", "Workspace B")];

    renderList();

    const region = screen.getByRole("region", { name: "Pending invitations" });
    expect(within(region).getByText("Workspace A")).toBeInTheDocument();
    expect(within(region).getByText("Workspace B")).toBeInTheDocument();
  });

  it("accepts a specific invitation independently", async () => {
    h.invites.current = [invite("a", "Workspace A"), invite("b", "Workspace B")];
    h.accept.mockResolvedValue(undefined);

    renderList();

    const itemB = screen
      .getAllByRole("listitem")
      .find((el) => within(el).queryByText("Workspace B")) as HTMLElement;
    fireEvent.click(within(itemB).getByRole("button", { name: "Accept" }));

    await waitFor(() => expect(h.accept).toHaveBeenCalledWith("b"));
    expect(h.decline).not.toHaveBeenCalled();
  });

  it("declines a specific invitation independently", async () => {
    h.invites.current = [invite("a", "Workspace A"), invite("b", "Workspace B")];
    h.decline.mockResolvedValue(undefined);

    renderList();

    const itemA = screen
      .getAllByRole("listitem")
      .find((el) => within(el).queryByText("Workspace A")) as HTMLElement;
    fireEvent.click(within(itemA).getByRole("button", { name: "Decline" }));

    await waitFor(() => expect(h.decline).toHaveBeenCalledWith("a"));
    expect(h.accept).not.toHaveBeenCalled();
  });

  it("shows a per-row loading state and disables the other action while accepting", () => {
    h.invites.current = [invite("a", "Workspace A")];
    h.acceptStatus.current = "loading";

    renderList();

    const item = screen.getByRole("listitem");
    // Accept reflects the in-flight state via its loading text...
    expect(within(item).getByText("Accepting...")).toBeInTheDocument();
    // ...and Decline (a plain Button) is disabled so the row can't be double-submitted.
    expect(within(item).getByRole("button", { name: /decline/i })).toBeDisabled();
  });

  it("disables Accept while declining", () => {
    h.invites.current = [invite("a", "Workspace A")];
    h.declineStatus.current = "loading";

    renderList();

    const item = screen.getByRole("listitem");
    expect(within(item).getByText("Declining...")).toBeInTheDocument();
    expect(within(item).getByRole("button", { name: /accept/i })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("shows an accept failure as a friendly alert positioned above the action buttons", async () => {
    h.invites.current = [invite("a", "Workspace A")];
    h.accept.mockRejectedValue(
      Object.assign(new Error("raw server detail"), {
        errorCode: "WORKSPACE_INVITE_ALREADY_MEMBER",
      }),
    );

    renderList();

    const item = screen.getByRole("listitem");
    fireEvent.click(within(item).getByRole("button", { name: "Accept" }));

    const alert = await within(item).findByText(/failed to accept the invitation/i);
    expect(within(item).getByText(/you are already a member/i)).toBeInTheDocument();
    expect(within(item).queryByText(/raw server detail/i)).not.toBeInTheDocument();

    // The alert must precede the Accept button in DOM order (errors above actions).
    const acceptButton = within(item).getByRole("button", { name: "Accept" });
    expect(precedesInDom(alert, acceptButton)).toBe(true);
  });
});
