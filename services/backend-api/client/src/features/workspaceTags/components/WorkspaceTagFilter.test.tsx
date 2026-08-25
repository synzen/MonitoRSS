import "@testing-library/jest-dom";
import { ChakraProvider } from "@chakra-ui/react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { system } from "@/utils/theme";
import { WorkspaceTagFilter } from "./WorkspaceTagFilter";

const tags = [
  { id: "tag-b", name: "Beta", color: "blue" as const },
  { id: "tag-a", name: "alpha", color: "green" as const },
];

function renderFilter(
  overrides: Partial<React.ComponentProps<typeof WorkspaceTagFilter>> = {},
) {
  const onChange = vi.fn();
  const onRetry = vi.fn();
  const user = userEvent.setup();
  const result = render(
    <ChakraProvider value={system}>
      <WorkspaceTagFilter
        tags={tags}
        selectedTagIds={[]}
        onChange={onChange}
        status="success"
        onRetry={onRetry}
        {...overrides}
      />
    </ChakraProvider>,
  );

  return { onChange, onRetry, user, ...result };
}

describe("WorkspaceTagFilter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists tags as checkable options in a compact menu", async () => {
    const { user, onChange } = renderFilter();
    const trigger = screen.getByRole("button", {
      name: "Filter feeds by tags: 0 selected",
    });

    await user.click(trigger);
    const menu = await screen.findByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitemcheckbox")
        .map((option) => option.textContent),
    ).toEqual(["alpha", "Beta"]);

    await user.click(
      within(menu).getByRole("menuitemcheckbox", { name: "alpha" }),
    );
    expect(onChange).toHaveBeenLastCalledWith(["tag-a"]);
  });

  it("summarizes the selected count and retains checked options", async () => {
    const { user } = renderFilter({ selectedTagIds: ["tag-a"] });
    const trigger = screen.getByRole("button", {
      name: "Filter feeds by tags: 1 selected",
    });

    expect(trigger).toHaveTextContent("Tags: 1 selected");
    await user.click(trigger);
    expect(
      await screen.findByRole("menuitemcheckbox", { name: "alpha" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("announces the loading state", () => {
    renderFilter({ status: "loading" });

    expect(screen.getByText("Loading Team tags.")).toBeInTheDocument();
  });

  it("offers recoverable failure retry", async () => {
    const { onRetry, user } = renderFilter({
      status: "error",
      error: new Error("Tag service unavailable"),
    });

    expect(
      screen.getByText(
        "Team tags could not load. Use Retry loading tags to try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Tag service unavailable")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Retry loading tags" }),
    );
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
