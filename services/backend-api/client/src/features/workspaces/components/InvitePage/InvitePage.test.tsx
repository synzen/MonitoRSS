import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
import { useUserMe } from "@/features/discordUser";
import { InvitePage } from "./index";

const h = vi.hoisted(() => ({
  accept: vi.fn(),
  decline: vi.fn(),
  sendInviteVerification: vi.fn(),
  navigate: vi.fn(),
  invalidate: vi.fn(),
  invite: {
    current: null as null | {
      id: string;
      emailHint: string;
      email?: string;
      role: string;
      workspaceName: string;
      invitedByUserId: string;
      createdAt: string;
      alreadyMember?: boolean;
    },
  },
  inviteStatus: { current: "success" as "loading" | "success" | "error" },
}));

vi.mock("@/features/discordUser", () => ({
  useUserMe: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: h.invalidate }),
}));

vi.mock("../../hooks", () => ({
  useWorkspaceInvite: () => ({
    invite: h.invite.current,
    status: h.inviteStatus.current,
    error: null,
    refetch: vi.fn(),
  }),
  useAcceptWorkspaceInvite: () => ({ mutateAsync: h.accept, status: "idle", error: null }),
  useDeclineWorkspaceInvite: () => ({ mutateAsync: h.decline, status: "idle", error: null }),
  useSendInviteVerification: () => ({
    mutateAsync: h.sendInviteVerification,
    status: "idle",
    error: null,
    reset: vi.fn(),
  }),
  // VerifyEmailStep (rendered in the mismatch branch) pulls these from the barrel.
  useSendEmailVerification: () => ({
    mutateAsync: vi.fn(),
    status: "idle",
    error: null,
    reset: vi.fn(),
  }),
  useConfirmEmailVerification: () => ({ mutateAsync: vi.fn(), status: "idle", error: null }),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => h.navigate,
  useParams: () => ({ inviteId: "invite-1" }),
}));

// True when `first` appears before `second` in document order. Avoids the bitwise
// compareDocumentPosition mask (no-bitwise) by walking the rendered tree.
const precedesInDom = (first: Element, second: Element): boolean => {
  const all = Array.from(document.querySelectorAll("*"));

  return all.indexOf(first) < all.indexOf(second);
};

// The GET endpoint returns the full `email` ONLY when the caller's verified email
// matches the invite; otherwise it returns just a redacted `emailHint`. Model both
// cases so the component is tested against the real contract.
const seedInvite = (
  email: string,
  { matched, alreadyMember }: { matched: boolean; alreadyMember?: boolean },
) => {
  h.invite.current = {
    id: "invite-1",
    emailHint: "i***@example.com",
    ...(matched ? { email } : {}),
    role: "admin",
    workspaceName: "Acme Team",
    invitedByUserId: "inviter-1",
    createdAt: new Date().toISOString(),
    alreadyMember,
  };
};

const mockUser = (verifiedEmail?: string) =>
  vi.mocked(useUserMe).mockReturnValue({
    data: { result: { email: "discord@example.com", verifiedEmail } },
  } as never);

const renderPage = () =>
  render(
    <ChakraProvider value={system}>
      <InvitePage />
    </ChakraProvider>,
  );

describe("InvitePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.inviteStatus.current = "success";
    h.invite.current = null;
  });

  it("shows the workspace name and the full invited address when the caller matches", () => {
    seedInvite("invitee@example.com", { matched: true });
    mockUser("invitee@example.com");

    renderPage();

    expect(screen.getByRole("heading", { name: "Acme Team" })).toBeInTheDocument();
    expect(screen.getByText("invitee@example.com")).toBeInTheDocument();
  });

  it("offers accept and decline when the verified email matches the invited email", () => {
    seedInvite("invitee@example.com", { matched: true });
    mockUser("invitee@example.com");

    renderPage();

    expect(screen.getByRole("button", { name: /accept invitation/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /decline/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send code/i })).not.toBeInTheDocument();
  });

  it("accepts the invitation and navigates into the joined workspace", async () => {
    seedInvite("invitee@example.com", { matched: true });
    mockUser("invitee@example.com");
    h.accept.mockResolvedValue({ result: { workspaceSlug: "acme-team" } });

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /accept invitation/i }));

    await waitFor(() => expect(h.accept).toHaveBeenCalledWith("invite-1"));
    // Drops the invitee into the workspace they just joined, not personal feeds.
    expect(h.navigate).toHaveBeenCalledWith("/workspaces/acme-team/feeds");
  });

  it("shows an accept failure as a friendly alert positioned above the action buttons", async () => {
    seedInvite("invitee@example.com", { matched: true });
    mockUser("invitee@example.com");
    h.accept.mockRejectedValue(
      Object.assign(new Error("raw server detail"), {
        errorCode: "WORKSPACE_INVITE_ALREADY_MEMBER",
      }),
    );

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /accept invitation/i }));

    const alert = await screen.findByText(/failed to accept the invitation/i);
    expect(screen.getByText(/you are already a member/i)).toBeInTheDocument();
    expect(screen.queryByText(/raw server detail/i)).not.toBeInTheDocument();
    expect(h.navigate).not.toHaveBeenCalled();

    // The alert must precede the Accept button in DOM order (errors above actions).
    const acceptButton = screen.getByRole("button", { name: /accept invitation/i });
    expect(precedesInDom(alert, acceptButton)).toBe(true);
  });

  it("tells an already-member caller there's nothing to accept, without offering verification or accept", () => {
    // The self-accept dead-end: an existing member (e.g. the owner) opens their
    // own invite. The page must short-circuit BEFORE the verify step so the
    // caller's verified email is never overwritten for an accept the server would
    // reject anyway.
    seedInvite("invitee@example.com", { matched: false, alreadyMember: true });
    mockUser("someone-else@example.com");

    renderPage();

    expect(screen.getByText(/you're already a member/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send code/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /accept invitation/i })).not.toBeInTheDocument();
  });

  it("guides the user to verify when emails do not match (server withholds the full address)", () => {
    // Unmatched caller: the server returns only the hint, so the field is not
    // locked — the user types the invited address, which the server gates.
    seedInvite("invitee@example.com", { matched: false });
    mockUser("someone-else@example.com");

    renderPage();

    expect(screen.getByRole("button", { name: /send code/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /accept invitation/i })).not.toBeInTheDocument();
    // The copy acknowledges the address the user has already verified, distinguishing
    // this from the "no verified email at all" case.
    expect(screen.getByText(/you've verified/i)).toBeInTheDocument();
    expect(screen.getByText("someone-else@example.com")).toBeInTheDocument();
    // The redacted hint is shown for context (never the full invited address).
    expect(screen.getAllByText("i***@example.com").length).toBeGreaterThan(0);
  });

  it("guides verification when the user has no verified email at all", () => {
    seedInvite("invitee@example.com", { matched: false });
    mockUser(undefined);

    renderPage();

    expect(screen.getByRole("button", { name: /send code/i })).toBeInTheDocument();
    // With no verified email, the copy does NOT claim the user has verified anything.
    expect(screen.queryByText(/you've verified/i)).not.toBeInTheDocument();
  });

  it("blocks sending a code to an address that can't match the invited hint", async () => {
    // Hint is i***@example.com; the user is unmatched so the field is editable.
    seedInvite("invitee@example.com", { matched: false });
    mockUser("someone-else@example.com");

    renderPage();

    const emailInput = screen.getByLabelText(/email address/i);
    // A clearly-unrelated address (wrong first char AND wrong domain).
    fireEvent.change(emailInput, { target: { value: "attacker@evil.com" } });
    fireEvent.click(screen.getByRole("button", { name: /send code/i }));

    // The guard fires: no verification send is dispatched, and the user is told
    // which address to use (referencing the hint).
    await waitFor(() =>
      expect(
        screen.getByText(/enter the address this invitation was sent to/i),
      ).toBeInTheDocument(),
    );
    expect(h.sendInviteVerification).not.toHaveBeenCalled();
  });

  it("sends an invite-scoped code when the typed address matches the hint", async () => {
    seedInvite("invitee@example.com", { matched: false });
    mockUser("someone-else@example.com");
    h.sendInviteVerification.mockResolvedValue(undefined);

    renderPage();

    const emailInput = screen.getByLabelText(/email address/i);
    // Matches the hint i***@example.com: first char "i" + domain example.com.
    fireEvent.change(emailInput, { target: { value: "invitee@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /send code/i }));

    await waitFor(() =>
      expect(h.sendInviteVerification).toHaveBeenCalledWith({
        inviteId: "invite-1",
        details: { email: "invitee@example.com" },
      }),
    );
  });

  it("labels the loading state for assistive technology", () => {
    h.inviteStatus.current = "loading";
    mockUser("invitee@example.com");

    renderPage();

    expect(screen.getByText("Loading invitation")).toBeInTheDocument();
  });

  it("shows an unavailable message when the invitation cannot be loaded", () => {
    h.inviteStatus.current = "error";
    mockUser("invitee@example.com");

    renderPage();

    expect(screen.getByRole("heading", { name: /invitation unavailable/i })).toBeInTheDocument();
  });
});
