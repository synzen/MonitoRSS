import { useRef, useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, Portal } from "@chakra-ui/react";
import { describe, it, expect, vi } from "vitest";
import { system } from "@/utils/theme";
import { ConfirmModal } from "./index";

const renderWithProvider = (ui: React.ReactElement) =>
  render(<ChakraProvider value={system}>{ui}</ChakraProvider>);

describe("ConfirmModal", () => {
  it("opens from its own trigger and confirms", async () => {
    const onConfirm = vi.fn();
    renderWithProvider(
      <ConfirmModal
        trigger={<button type="button">Open</button>}
        title="Are you sure?"
        description="This cannot be undone."
        okText="Yes"
        cancelText="No"
        colorScheme="red"
        onConfirm={onConfirm}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Open" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Yes" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("supports controlled open state", async () => {
    const Controlled = () => {
      const [open, setOpen] = useState(false);

      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Trigger elsewhere
          </button>
          <ConfirmModal
            open={open}
            onOpenChange={setOpen}
            title="Confirm?"
            description="Body"
            okText="Go"
            cancelText="Stop"
            colorScheme="red"
            onConfirm={vi.fn()}
          />
        </>
      );
    };

    renderWithProvider(<Controlled />);

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Trigger elsewhere" }));

    expect(await screen.findByRole("alertdialog")).toBeVisible();
  });

  it("renders no close button by default", async () => {
    renderWithProvider(
      <ConfirmModal open onOpenChange={vi.fn()} title="Confirm?" onConfirm={vi.fn()} />,
    );

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).queryByRole("button", { name: /close/i })).not.toBeInTheDocument();
  });

  it("closes from the opt-in close button without confirming", async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    const onClosed = vi.fn();

    renderWithProvider(
      <ConfirmModal
        open
        onOpenChange={onOpenChange}
        onClosed={onClosed}
        title="Confirm?"
        showCloseButton
        onConfirm={onConfirm}
      />,
    );

    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /close/i }));

    // The X is a dismissal, not a confirmation: it routes through the close path
    // (so controlled callers reset) and never fires onConfirm.
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // By default the modal stays open until onConfirm resolves, so a slow/failing
  // action can surface its outcome inline (via the `error` prop) and be retried.
  it("by default keeps the dialog open while onConfirm is pending", async () => {
    let resolveConfirm: () => void = () => {};

    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = resolve;
        }),
    );
    const onOpenChange = vi.fn();

    renderWithProvider(
      <ConfirmModal
        open
        onOpenChange={onOpenChange}
        title="Confirm?"
        okText="Go"
        onConfirm={onConfirm}
      />,
    );

    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Go" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    // Still open: onConfirm has not resolved, so the close path has not run.
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole("alertdialog")).toBeVisible();

    resolveConfirm();
  });

  // closeOnConfirm is the "gate" mode: the modal reports nothing inline, so it
  // dismisses the instant confirm is clicked instead of holding a backdrop over
  // the page for the whole (here: never-resolving) request.
  it("with closeOnConfirm, closes immediately without waiting for onConfirm", async () => {
    // A promise that never resolves stands in for an in-flight request.
    const onConfirm = vi.fn(() => new Promise<void>(() => {}));
    const onOpenChange = vi.fn();

    renderWithProvider(
      <ConfirmModal
        open
        onOpenChange={onOpenChange}
        title="Confirm?"
        okText="Go"
        onConfirm={onConfirm}
        closeOnConfirm
      />,
    );

    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Go" }));

    // Closed right away even though onConfirm is still pending.
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  // Escape is blocked by default: a reflexive keypress must not drop a
  // high-impact (e.g. irreversible) action mid-confirmation.
  it("ignores Escape by default", async () => {
    const onOpenChange = vi.fn();

    renderWithProvider(
      <ConfirmModal open onOpenChange={onOpenChange} title="Confirm?" onConfirm={vi.fn()} />,
    );

    const dialog = await screen.findByRole("alertdialog");
    await userEvent.keyboard("{Escape}");

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(dialog).toBeVisible();
  });

  // allowEscape opts reversible actions into a quick keyboard exit.
  it("closes on Escape (without confirming) when allowEscape is set", async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    const onClosed = vi.fn();

    renderWithProvider(
      <ConfirmModal
        open
        allowEscape
        onOpenChange={onOpenChange}
        onClosed={onClosed}
        title="Confirm?"
        onConfirm={onConfirm}
      />,
    );

    await screen.findByRole("alertdialog");
    await userEvent.keyboard("{Escape}");

    // Escape routes through the explicit close path (like the X): it closes and
    // fires onClosed, but never confirms.
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // Regression: the bulk-delete confirmation opened from a menu item closed
  // immediately because the modal's open state lived inside the menu content,
  // which unmounts when the menu closes. The fix lifts the open state above the
  // collapsing container and renders the modal in a portal. This reproduces that
  // structure: the modal must survive the sibling "menu content" unmounting.
  it("stays open after the surrounding menu content unmounts", async () => {
    const onConfirm = vi.fn();

    const Harness = () => {
      const [open, setOpen] = useState(false);
      const [menuMounted, setMenuMounted] = useState(true);

      return (
        <>
          {/* Stand-in for MenuContent: unmounts (like a closing menu) once an action is picked. */}
          {menuMounted && (
            <div>
              <button
                type="button"
                onClick={() => {
                  setOpen(true);
                  setMenuMounted(false);
                }}
              >
                Delete menu item
              </button>
            </div>
          )}
          <Portal>
            <ConfirmModal
              open={open}
              onOpenChange={setOpen}
              title="Are you sure you want to delete 2 feed(s)?"
              description="This action cannot be undone."
              okText="Delete"
              cancelText="Cancel"
              colorScheme="red"
              onConfirm={onConfirm}
            />
          </Portal>
        </>
      );
    };

    renderWithProvider(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "Delete menu item" }));

    // The menu has unmounted, but the dialog must remain open (the bug closed it here).
    expect(screen.queryByRole("button", { name: "Delete menu item" })).not.toBeInTheDocument();
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toBeVisible();
    expect(screen.getByText("Are you sure you want to delete 2 feed(s)?")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  // Default role is alertdialog (a brief confirmation); content-rich callers
  // opt into a plain dialog.
  it("defaults to the alertdialog role", async () => {
    renderWithProvider(
      <ConfirmModal open onOpenChange={vi.fn()} title="Confirm?" onConfirm={vi.fn()} />,
    );

    expect(await screen.findByRole("alertdialog")).toBeVisible();
  });

  it("renders as a plain dialog when role='dialog' is passed", async () => {
    renderWithProvider(
      <ConfirmModal
        open
        role="dialog"
        onOpenChange={vi.fn()}
        title="Move your plan"
        onConfirm={vi.fn()}
      />,
    );

    expect(await screen.findByRole("dialog")).toBeVisible();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  // By default focus lands on Cancel (the safe target for a yes/no). A
  // content-rich dialog overrides this so focus starts at the top of the content
  // and the user reads forward, instead of being dropped on Cancel at the end of
  // the DOM with the task surface behind them.
  it("focuses the initialFocusEl override on open instead of Cancel", async () => {
    const Harness = () => {
      const introRef = useRef<HTMLParagraphElement>(null);

      return (
        <ConfirmModal
          open
          role="dialog"
          onOpenChange={vi.fn()}
          title="Move your plan"
          onConfirm={vi.fn()}
          initialFocusEl={() => introRef.current}
          descriptionNode={
            <p ref={introRef} tabIndex={-1} data-testid="intro">
              Read this first.
            </p>
          }
        />
      );
    };

    renderWithProvider(<Harness />);

    const intro = await screen.findByTestId("intro");
    await waitFor(() => expect(intro).toHaveFocus());
    expect(screen.getByRole("button", { name: /cancel/i })).not.toHaveFocus();
  });
});
