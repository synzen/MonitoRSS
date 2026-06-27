import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
import { RevertVerifiedEmail } from "./RevertVerifiedEmail";

const h = vi.hoisted(() => ({
  revert: vi.fn(),
  status: "idle" as "idle" | "loading" | "success" | "error",
  error: null as { errorCode?: string; message: string } | null,
}));

vi.mock("@/features/workspaces", () => ({
  useRevertEmailVerification: () => ({
    mutateAsync: h.revert,
    status: h.status,
    error: h.error,
  }),
}));

const renderAt = (search: string) =>
  render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={[`/email-verification/revert${search}`]}>
        <RevertVerifiedEmail />
      </MemoryRouter>
    </ChakraProvider>,
  );

describe("RevertVerifiedEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.revert.mockResolvedValue(undefined);
    h.status = "idle";
    h.error = null;
  });

  it("does not revert automatically on load (requires an explicit click)", () => {
    renderAt("?token=abc.def");
    expect(h.revert).not.toHaveBeenCalled();
  });

  it("reverts with the token from the query string when the button is clicked", async () => {
    renderAt("?token=abc.def");

    fireEvent.click(screen.getByRole("button", { name: /revert/i }));

    await waitFor(() => expect(h.revert).toHaveBeenCalledWith({ details: { token: "abc.def" } }));
  });

  it("shows a success confirmation when the revert has succeeded", () => {
    h.status = "success";
    renderAt("?token=abc.def");

    expect(screen.getByText(/was reverted/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /revert this change/i })).not.toBeInTheDocument();
  });

  it("shows an error alert when the revert fails", () => {
    h.error = { message: "Invalid or expired token" };
    renderAt("?token=abc.def");

    expect(screen.getByText(/could not revert/i)).toBeInTheDocument();
  });

  it("shows an invalid-link message and no button when the token is missing", () => {
    renderAt("");
    expect(screen.getByText(/this link is invalid/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /revert this change/i })).not.toBeInTheDocument();
  });
});
