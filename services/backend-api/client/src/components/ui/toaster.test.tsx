import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect } from "vitest";
import { system } from "@/utils/theme";
import { notifyError } from "@/utils/notifyError";
import { Toaster } from "./toaster";

const renderToaster = () => render(<ChakraProvider value={system}>{<Toaster />}</ChakraProvider>);

describe("Toaster", () => {
  it("renders a dismissable close button on an error toast and removes it on click", async () => {
    renderToaster();

    notifyError("Something went wrong.", "This subscription has already been cancelled.");

    const toast = await screen.findByText("Something went wrong.");
    const toastRoot = toast.closest("[data-scope='toast'][data-part='root']") as HTMLElement;
    expect(toastRoot).not.toBeNull();

    const closeButton = within(toastRoot).getByRole("button");
    await userEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText("Something went wrong.")).not.toBeInTheDocument();
    });
  });
});
