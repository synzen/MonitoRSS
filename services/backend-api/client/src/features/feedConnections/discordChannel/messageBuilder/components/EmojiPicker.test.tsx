import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { describe, it, expect, vi } from "vitest";
import { EmojiPicker } from "./EmojiPicker";
import type { ButtonEmoji } from "../types";

vi.mock("@/features/discordServers", () => ({
  useDiscordServerEmojis: () => ({
    data: undefined,
    status: "idle",
    error: null,
    refetch: vi.fn(),
  }),
}));

const renderPicker = (props: Partial<React.ComponentProps<typeof EmojiPicker>> = {}) =>
  render(
    <ChakraProvider value={defaultSystem}>
      <EmojiPicker onChange={vi.fn()} {...props} />
    </ChakraProvider>,
  );

describe("EmojiPicker", () => {
  // Regression: Termly Auto Blocker (official hosts only) rewrites third-party <img src>
  // until consent; emoji images must stay pre-categorized as essential.
  it("marks the selected custom emoji as essential so the auto-blocker leaves src intact", () => {
    const emoji: ButtonEmoji = { id: "123456789", name: "cool", animated: false };

    renderPicker({ value: emoji });

    expect(screen.getByAltText("cool")).toHaveAttribute("data-categories", "essential");
  });
});
