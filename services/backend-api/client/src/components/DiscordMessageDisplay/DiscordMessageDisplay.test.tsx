import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { vi } from "vitest";

import { DiscordMessageDisplay } from "./index";

// Mock DiscordView to verify V1 messages are passed correctly
vi.mock("../DiscordView", () => ({
  default: vi.fn(({ messages, darkTheme, excludeHeader }) => (
    <div
      data-testid="discord-view"
      data-dark-theme={String(darkTheme)}
      data-exclude-header={String(excludeHeader)}
    >
      {messages?.map(
        (
          msg: { content?: string; embeds?: Array<{ title?: string; description?: string }> },
          i: number,
        ) => (
          <div key={i} data-testid="legacy-message">
            {msg.content && <span data-testid="message-content">{msg.content}</span>}
            {msg.embeds?.map((embed, j) => (
              <div key={j}>
                {embed.title && <span data-testid="embed-title">{embed.title}</span>}
                {embed.description && (
                  <span data-testid="embed-description">{embed.description}</span>
                )}
              </div>
            ))}
          </div>
        ),
      )}
    </div>
  )),
}));

// Wrapper with ChakraProvider for tests
const renderWithChakra = (ui: React.ReactElement) => {
  return render(<ChakraProvider>{ui}</ChakraProvider>);
};

// eslint-disable-next-line no-bitwise
const DISCORD_COMPONENTS_V2_FLAG = 1 << 15;

// Mock V2 message with various component types
const mockV2Message = {
  content: null,
  flags: DISCORD_COMPONENTS_V2_FLAG,
  components: [
    {
      type: 17, // Container
      accent_color: 5793266,
      components: [
        {
          type: 10, // TextDisplay
          content: "**Article Title**",
        },
        {
          type: 9, // Section
          components: [
            {
              type: 10,
              content: "Section text content",
            },
          ],
          accessory: {
            type: 11, // Thumbnail
            media: { url: "https://example.com/thumb.jpg" },
            description: "Thumbnail image",
          },
        },
        {
          type: 14, // Separator
          divider: true,
          spacing: 1,
        },
        {
          type: 1, // ActionRow
          components: [
            {
              type: 2, // Button
              style: 5, // Link
              label: "Read More",
              url: "https://example.com",
            },
            {
              type: 2,
              style: 1, // Primary
              label: "Subscribe",
            },
          ],
        },
      ],
    },
  ],
};

const mockV2WithMediaGallery = {
  content: null,
  flags: DISCORD_COMPONENTS_V2_FLAG,
  components: [
    {
      type: 12, // MediaGallery
      items: [
        { media: { url: "https://example.com/img1.jpg" }, description: "Image 1" },
        { media: { url: "https://example.com/img2.jpg" }, description: "Image 2" },
      ],
    },
  ],
};

const mockV2WithSpoiler = {
  content: null,
  flags: DISCORD_COMPONENTS_V2_FLAG,
  components: [
    {
      type: 17, // Container
      spoiler: true,
      components: [
        {
          type: 10,
          content: "Spoiler content",
        },
      ],
    },
  ],
};

const mockV1Message = {
  content: "Hello from MonitoRSS!",
  embeds: [
    {
      title: "Test Embed Title",
      description: "Test embed description",
      color: 5793266,
      url: "https://example.com",
    },
  ],
  flags: 0,
};

const mockUnknownComponentType = {
  content: null,
  flags: DISCORD_COMPONENTS_V2_FLAG,
  components: [
    {
      type: 999, // Unknown type
      content: "Unknown component",
    },
    {
      type: 10, // TextDisplay - valid
      content: "Valid component after unknown",
    },
  ],
};

describe("DiscordMessageDisplay", () => {
  describe("Empty State", () => {
    it("shows default empty message when messages array is empty", () => {
      renderWithChakra(<DiscordMessageDisplay messages={[]} />);

      expect(screen.getByText("No components added yet")).toBeInTheDocument();
    });

    it("shows custom empty message when provided", () => {
      renderWithChakra(<DiscordMessageDisplay messages={[]} emptyMessage="Custom empty message" />);

      expect(screen.getByText("Custom empty message")).toBeInTheDocument();
    });

    it("renders MonitoRSS header in empty state", () => {
      renderWithChakra(<DiscordMessageDisplay messages={[]} />);

      expect(screen.getByText("MonitoRSS")).toBeInTheDocument();
      expect(screen.getByText("✓ APP")).toBeInTheDocument();
    });
  });

  describe("Loading State", () => {
    it("shows progress bar when isLoading is true with messages", () => {
      renderWithChakra(<DiscordMessageDisplay messages={[mockV2Message]} isLoading />);

      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    it("does not show progress bar when isLoading is false", () => {
      renderWithChakra(<DiscordMessageDisplay messages={[mockV2Message]} isLoading={false} />);

      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    it("progress bar has correct aria-label", () => {
      renderWithChakra(<DiscordMessageDisplay messages={[mockV2Message]} isLoading />);

      expect(screen.getByLabelText("Updating message preview")).toBeInTheDocument();
    });
  });

  describe("V2 Components Rendering", () => {
    it("renders TextDisplay component", () => {
      renderWithChakra(<DiscordMessageDisplay messages={[mockV2Message]} />);

      expect(screen.getByText(/Article Title/)).toBeInTheDocument();
    });

    it("renders Section with text content", () => {
      renderWithChakra(<DiscordMessageDisplay messages={[mockV2Message]} />);

      expect(screen.getByText("Section text content")).toBeInTheDocument();
    });

    it("renders ActionRow with Link button and Primary button", () => {
      renderWithChakra(<DiscordMessageDisplay messages={[mockV2Message]} />);

      // Link buttons (style 5) render as anchors
      expect(screen.getByRole("link", { name: /Read More/i })).toBeInTheDocument();
      // Primary buttons (style 1) render as buttons
      expect(screen.getByRole("button", { name: /Subscribe/i })).toBeInTheDocument();
    });

    it("renders Link button with correct attributes", () => {
      renderWithChakra(<DiscordMessageDisplay messages={[mockV2Message]} />);

      const linkButton = screen.getByRole("link", { name: /Read More/i });

      expect(linkButton).toHaveAttribute("href", "https://example.com");
      expect(linkButton).toHaveAttribute("target", "_blank");
    });

    it("renders MediaGallery component without crashing", () => {
      // MediaGallery renders a grid with image containers
      // In test environment, images may show fallback UI since URLs don't load
      const { container } = renderWithChakra(
        <DiscordMessageDisplay messages={[mockV2WithMediaGallery]} />,
      );

      // Verify the component renders (doesn't throw)
      expect(container.querySelector(".chakra-stack")).toBeInTheDocument();

      // MediaGallery items show fallback text when images don't load
      expect(screen.getAllByText(/Loading|No image/i).length).toBeGreaterThanOrEqual(1);
    });

    it("renders Separator/Divider", () => {
      renderWithChakra(<DiscordMessageDisplay messages={[mockV2Message]} />);

      expect(screen.getByRole("separator")).toBeInTheDocument();
    });
  });

  describe("Spoiler Overlay", () => {
    it("renders SPOILER overlay when spoiler flag is true", () => {
      renderWithChakra(<DiscordMessageDisplay messages={[mockV2WithSpoiler]} />);

      expect(screen.getByText("SPOILER")).toBeInTheDocument();
    });

    it("spoiler overlay has accessibility attributes", () => {
      renderWithChakra(<DiscordMessageDisplay messages={[mockV2WithSpoiler]} />);

      const spoilerOverlay = screen.getByLabelText("Content hidden: spoiler");
      expect(spoilerOverlay).toBeInTheDocument();
      expect(spoilerOverlay).toHaveAttribute("role", "img");
    });
  });

  describe("Unknown Component Handling", () => {
    it("gracefully skips unknown component types without crashing", () => {
      renderWithChakra(<DiscordMessageDisplay messages={[mockUnknownComponentType]} />);

      // Should render the valid component that comes after the unknown one
      expect(screen.getByText("Valid component after unknown")).toBeInTheDocument();
    });
  });

  describe("V1 Legacy Embed Rendering", () => {
    it("renders V1 message content through DiscordView", () => {
      renderWithChakra(<DiscordMessageDisplay messages={[mockV1Message]} />);

      // Verify MonitoRSS header renders
      expect(screen.getByText("MonitoRSS")).toBeInTheDocument();

      // Verify DiscordView is rendered with correct props
      const discordView = screen.getByTestId("discord-view");
      expect(discordView).toBeInTheDocument();
      expect(discordView).toHaveAttribute("data-dark-theme", "true");
      expect(discordView).toHaveAttribute("data-exclude-header", "true");
    });

    it("passes V1 message content to DiscordView", () => {
      renderWithChakra(<DiscordMessageDisplay messages={[mockV1Message]} />);

      // Verify message content is passed through
      expect(screen.getByTestId("message-content")).toHaveTextContent("Hello from MonitoRSS!");
    });

    it("passes V1 embed title and description to DiscordView", () => {
      renderWithChakra(<DiscordMessageDisplay messages={[mockV1Message]} />);

      // Verify embed properties are passed through
      expect(screen.getByTestId("embed-title")).toHaveTextContent("Test Embed Title");
      expect(screen.getByTestId("embed-description")).toHaveTextContent("Test embed description");
    });

    it("does not render DiscordView for V2 messages", () => {
      renderWithChakra(<DiscordMessageDisplay messages={[mockV2Message]} />);

      // V2 messages should NOT use DiscordView
      expect(screen.queryByTestId("discord-view")).not.toBeInTheDocument();
    });
  });

  describe("Discord Header", () => {
    it("renders MonitoRSS avatar", () => {
      renderWithChakra(<DiscordMessageDisplay messages={[mockV2Message]} />);

      const avatar = screen.getByRole("img", { name: "MonitoRSS" });

      expect(avatar).toBeInTheDocument();
    });

    it("renders APP badge", () => {
      renderWithChakra(<DiscordMessageDisplay messages={[mockV2Message]} />);

      expect(screen.getByText("✓ APP")).toBeInTheDocument();
    });

    it("renders timestamp", () => {
      renderWithChakra(<DiscordMessageDisplay messages={[mockV2Message]} />);

      expect(screen.getByText("Today at 12:04 PM")).toBeInTheDocument();
    });
  });

  describe("Snapshot Tests", () => {
    it("matches snapshot for V2 message", () => {
      const { container } = renderWithChakra(<DiscordMessageDisplay messages={[mockV2Message]} />);

      expect(container).toMatchSnapshot();
    });

    it("matches snapshot for empty state", () => {
      const { container } = renderWithChakra(<DiscordMessageDisplay messages={[]} />);

      expect(container).toMatchSnapshot();
    });

    it("matches snapshot for loading state", () => {
      const { container } = renderWithChakra(<DiscordMessageDisplay messages={[]} isLoading />);

      expect(container).toMatchSnapshot();
    });

    it("matches snapshot for MediaGallery", () => {
      const { container } = renderWithChakra(
        <DiscordMessageDisplay messages={[mockV2WithMediaGallery]} />,
      );

      expect(container).toMatchSnapshot();
    });
  });
});
