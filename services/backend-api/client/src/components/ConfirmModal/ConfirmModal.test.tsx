import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
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
});
