import "@testing-library/jest-dom";
import { ChakraProvider } from "@chakra-ui/react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { system } from "@/utils/theme";
import { WorkspaceTagList } from "./WorkspaceTagList";

const tags = [
  { id: "3", name: "Zulu", color: "purple" as const },
  { id: "1", name: "alpha", color: "green" as const },
  { id: "2", name: "Beta", color: "blue" as const },
  { id: "4", name: "Delta" },
];

describe("WorkspaceTagList", () => {
  it("renders alphabetical, noninteractive chips with accessible overflow disclosure", async () => {
    const user = userEvent.setup();
    render(
      <ChakraProvider value={system}>
        <WorkspaceTagList tags={tags} maxVisible={2} />
      </ChakraProvider>,
    );

    const visibleChips = screen.getAllByTestId("workspace-tag-chip");
    expect(visibleChips.slice(0, 2).map((chip) => chip.textContent)).toEqual(["alpha", "Beta"]);
    expect(visibleChips[0]).not.toHaveAttribute("tabindex");

    const overflow = screen.getByRole("button", {
      name: "Show all tags (2 more)",
    });
    await user.click(overflow);
    expect(await screen.findByRole("dialog", { name: "All tags" })).toHaveTextContent(
      "alphaBetaDeltaZulu",
    );

    await user.keyboard("{Escape}");
    expect(overflow).toHaveFocus();
  });

  it("calculates overflow from the available cell width", async () => {
    const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    const offsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");

    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return (this as HTMLElement).dataset.testid === "workspace-tag-list" ? 170 : 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get() {
        return (this as HTMLElement).textContent?.startsWith("+") ? 35 : 70;
      },
    });

    try {
      render(
        <ChakraProvider value={system}>
          <WorkspaceTagList tags={tags} />
        </ChakraProvider>,
      );

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Show all tags (3 more)" })).toBeVisible(),
      );
    } finally {
      if (clientWidth) {
        Object.defineProperty(HTMLElement.prototype, "clientWidth", clientWidth);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
      }

      if (offsetWidth) {
        Object.defineProperty(HTMLElement.prototype, "offsetWidth", offsetWidth);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "offsetWidth");
      }
    }
  });
});
