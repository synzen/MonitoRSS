import { ChakraProvider, Field } from "@chakra-ui/react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { system } from "@/utils/theme";
import ApiAdapterError from "@/utils/ApiAdapterError";
import "@/utils/i18n";
import { DiscordChannelDropdown } from "./index";

const mocks = vi.hoisted(() => ({
  useDiscordServerChannels: vi.fn(),
}));

vi.mock("../../hooks", () => ({
  useDiscordServerChannels: mocks.useDiscordServerChannels,
}));

vi.mock("@/components", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components")>()),
  ThemedSelect: () => <div data-testid="themed-select" />,
}));

vi.mock("@/features/feedConnections", () => ({
  getChannelIcon: vi.fn(),
}));

describe("DiscordChannelDropdown", () => {
  beforeEach(() => {
    mocks.useDiscordServerChannels.mockReturnValue({
      data: undefined,
      error: new ApiAdapterError("Unable to load Discord channels."),
      isFetching: false,
    });
  });

  it("shows channel loading errors to the user", () => {
    render(
      <ChakraProvider value={system}>
        <Field.Root invalid={false}>
          <DiscordChannelDropdown
            serverId="server-1"
            onChange={vi.fn()}
            onBlur={vi.fn()}
            isInvalid={false}
            ariaLabelledBy="channel-label"
          />
        </Field.Root>
      </ChakraProvider>,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toBeVisible();
    expect(alert).toHaveTextContent("Failed to get server channels");
    expect(alert).toHaveTextContent("Unable to load Discord channels.");
  });
});
