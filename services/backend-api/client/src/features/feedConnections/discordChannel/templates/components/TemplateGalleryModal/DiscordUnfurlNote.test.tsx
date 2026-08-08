import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DialogContent, DialogRoot } from "@/components/ui/dialog";
import { system } from "@/utils/theme";
import { DiscordUnfurlNote } from "./DiscordUnfurlNote";

const NestedPopoverDialog = () => {
  const [open, setOpen] = useState(true);

  return (
    <ChakraProvider value={system}>
      <DialogRoot open={open} onOpenChange={(details) => setOpen(details.open)}>
        <DialogContent data-testid="gallery-dialog">
          <DiscordUnfurlNote />
        </DialogContent>
      </DialogRoot>
    </ChakraProvider>
  );
};

describe("DiscordUnfurlNote", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("closes only the popover when Escape is pressed immediately after opening", async () => {
    render(<NestedPopoverDialog />);

    await act(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, 50);
        }),
    );
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(0);
    const trigger = screen.getByRole("button", { name: "Why a card might not appear" });

    await act(async () => {
      fireEvent.click(trigger);
    });
    expect(screen.getByText(/does not provide preview data/i)).toBeVisible();

    await act(async () => {
      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    });
    requestAnimationFrameSpy.mockRestore();

    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });
    expect(screen.getByTestId("gallery-dialog")).toBeVisible();
  });
});
