import "@testing-library/jest-dom";
import { ChakraProvider } from "@chakra-ui/react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { system } from "@/utils/theme";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { WorkspaceTagSelector } from "./WorkspaceTagSelector";

const createTag = vi.fn();
const resetCreateTag = vi.fn();
const refetchTags = vi.fn();
let createError: ApiAdapterError | null = null;
let listStatus = "success";
let createStatus = "idle";

vi.mock("../hooks", () => ({
  useWorkspaceTags: () => ({
    data: {
      results: [
        { id: "tag-b", name: "Beta", color: "blue" },
        { id: "tag-a", name: "alpha", color: "green" },
      ],
    },
    status: listStatus,
    error: null,
    refetch: refetchTags,
  }),
  useCreateWorkspaceTag: () => ({
    mutateAsync: createTag,
    status: createStatus,
    error: createError,
    reset: resetCreateTag,
  }),
}));

function renderSelector(selectedTagIds: string[] = []) {
  const onChange = vi.fn();
  const user = userEvent.setup();
  const result = render(
    <ChakraProvider value={system}>
      <WorkspaceTagSelector
        workspaceSlug="team-space"
        selectedTagIds={selectedTagIds}
        onChange={onChange}
      />
    </ChakraProvider>,
  );

  return { onChange, user, ...result };
}

describe("WorkspaceTagSelector", () => {
  beforeEach(() => {
    createError = null;
    listStatus = "success";
    createStatus = "idle";
    createTag.mockReset();
    resetCreateTag.mockReset();
    refetchTags.mockReset();
    createTag.mockResolvedValue({
      result: { id: "tag-new", name: "Launch", color: "purple" },
    });
  });

  it("searches case-insensitively and returns tags in alphabetical order", async () => {
    const { user } = renderSelector();
    const input = screen.getByLabelText("Tags");
    await user.click(input);

    const options = within(await screen.findByRole("listbox")).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["alpha", "Beta"]);

    await user.type(input, "ALP");
    expect(await screen.findByRole("option", { name: "alpha" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Beta" })).not.toBeInTheDocument();
  });

  it("keeps tag creation contextual and selects the created tag", async () => {
    const { user, onChange } = renderSelector(["tag-a"]);

    expect(screen.queryByRole("radiogroup", { name: "Tag color" })).not.toBeInTheDocument();
    const input = screen.getByLabelText("Tags");
    await user.type(input, "Launch");
    await user.click(screen.getByRole("button", { name: "New tag" }));

    expect(screen.getByLabelText("Tag name")).toHaveValue("Launch");
    expect(
      screen.getByText("Create a tag your Team can reuse on other feeds."),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Neutral" })).toBeChecked();
    await user.tab();
    expect(screen.getByRole("radio", { name: "Neutral" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Red" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Purple" }));
    expect(screen.getByRole("radio", { name: "Purple" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Create and add" }));

    await waitFor(() =>
      expect(createTag).toHaveBeenCalledWith({
        workspaceSlug: "team-space",
        data: { name: "Launch", color: "purple" },
      }),
    );
    expect(onChange).toHaveBeenCalledWith(["tag-a", "tag-new"]);
    expect(screen.queryByRole("radiogroup", { name: "Tag color" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "New tag" })).toHaveFocus());
  });

  it("adds and removes tags through the complete selection value", async () => {
    const { user, onChange, unmount } = renderSelector();
    const input = screen.getByLabelText("Tags");
    await user.click(input);
    await user.click(await screen.findByRole("option", { name: "alpha" }));
    expect(onChange).toHaveBeenLastCalledWith(["tag-a"]);

    unmount();
    const second = renderSelector(["tag-a"]);
    const removeButton = screen.getByLabelText("Remove alpha");
    expect(removeButton.tagName).toBe("BUTTON");
    expect(screen.getByTestId("workspace-tag-selected-chip")).toHaveTextContent("alpha");
    await second.user.click(removeButton);
    expect(second.onChange).toHaveBeenLastCalledWith([]);
  });

  it("explains and enforces the 10-tag selection limit without blocking removals", async () => {
    const { user } = renderSelector(Array.from({ length: 10 }, (_, index) => `tag-${index}`));

    expect(
      screen.getByText("You’ve added the maximum of 10 tags. Remove one to add another."),
    ).toBeInTheDocument();
    const input = screen.getByLabelText("Tags");
    expect(input).not.toBeDisabled();
    await user.click(input);
    expect(await screen.findByRole("option", { name: "alpha" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: "New tag" })).toBeDisabled();
  });

  it("shows a recoverable creation error inside the creation panel", async () => {
    createError = new ApiAdapterError("A tag with this name already exists in this Team.");
    const { user } = renderSelector();

    await user.click(screen.getByRole("button", { name: "New tag" }));
    expect(
      screen.getByText("A tag with this name already exists in this Team."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(resetCreateTag).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "New tag" })).toHaveFocus();
  });

  it("returns focus to the tag selector when creation reaches the limit", async () => {
    const { user } = renderSelector(Array.from({ length: 9 }, (_, index) => `tag-${index}`));

    await user.click(screen.getByRole("button", { name: "New tag" }));
    await user.type(screen.getByLabelText("Tag name"), "Launch");
    await user.click(screen.getByRole("button", { name: "Create and add" }));

    await waitFor(() => expect(screen.getByLabelText("Tags")).toHaveFocus());
  });

  it("announces an inline loading state while creating", async () => {
    createStatus = "loading";
    const { user } = renderSelector();

    await user.click(screen.getByRole("button", { name: "New tag" }));
    await user.type(screen.getByLabelText("Tag name"), "Launch");
    expect(screen.getByRole("button", { name: "Creating…" })).toHaveAttribute("aria-busy", "true");
  });
});
