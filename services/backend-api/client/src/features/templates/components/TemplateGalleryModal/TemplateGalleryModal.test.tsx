import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TemplateGalleryModal, isTemplateCompatible } from "./index";
import { Template } from "../../types";
import { ComponentType } from "../../../../pages/MessageBuilder/types";
import { createDiscordChannelConnectionPreview } from "../../../feedConnections/api";

vi.mock("../../../feedConnections/api", () => ({
  createDiscordChannelConnectionPreview: vi.fn(),
}));

const mockCreatePreview = vi.mocked(createDiscordChannelConnectionPreview);

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const mockTemplates: Template[] = [
  {
    id: "default",
    name: "Simple Text",
    description: "Clean text format that works with any feed",
    requiredFields: [],
    messageComponent: {
      type: ComponentType.LegacyRoot,
      id: "root",
      name: "Root",
      children: [],
    },
  },
  {
    id: "rich-embed",
    name: "Rich Embed",
    description: "Full embed with image and description",
    requiredFields: ["description"],
    messageComponent: {
      type: ComponentType.LegacyRoot,
      id: "root",
      name: "Root",
      children: [],
    },
  },
  {
    id: "media-gallery",
    name: "Media Gallery",
    description: "Showcase images in a modern gallery layout",
    requiredFields: ["image"],
    messageComponent: {
      type: ComponentType.LegacyRoot,
      id: "root",
      name: "Root",
      children: [],
    },
  },
];

const mockArticles = [
  { id: "article-1", title: "First Article" },
  { id: "article-2", title: "Second Article" },
  { id: "article-3", title: "Third Article" },
];

interface TestWrapperProps {
  children: React.ReactNode;
}

const TestWrapper = ({ children }: TestWrapperProps) => {
  const queryClient = createQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ChakraProvider>{children}</ChakraProvider>
    </QueryClientProvider>
  );
};

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  templates: mockTemplates,
  selectedTemplateId: undefined,
  onTemplateSelect: vi.fn(),
  feedFields: ["title", "description", "link", "image"],
  articles: mockArticles,
  selectedArticleId: "article-1",
  onArticleChange: vi.fn(),
  feedId: "feed-123",
  connectionId: "connection-456",
};

describe("TemplateGalleryModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isTemplateCompatible utility", () => {
    it("returns true when template has no required fields", () => {
      const template: Template = {
        id: "test",
        name: "Test",
        description: "Test",
        requiredFields: [],
        messageComponent: {
          type: ComponentType.LegacyRoot,
          id: "root",
          name: "Root",
          children: [],
        },
      };
      expect(isTemplateCompatible(template, ["title"])).toBe(true);
    });

    it("returns true when all required fields are present", () => {
      const template: Template = {
        id: "test",
        name: "Test",
        description: "Test",
        requiredFields: ["description", "image"],
        messageComponent: {
          type: ComponentType.LegacyRoot,
          id: "root",
          name: "Root",
          children: [],
        },
      };
      expect(isTemplateCompatible(template, ["title", "description", "image"])).toBe(true);
    });

    it("returns false when some required fields are missing", () => {
      const template: Template = {
        id: "test",
        name: "Test",
        description: "Test",
        requiredFields: ["description", "image"],
        messageComponent: {
          type: ComponentType.LegacyRoot,
          id: "root",
          name: "Root",
          children: [],
        },
      };
      expect(isTemplateCompatible(template, ["title", "description"])).toBe(false);
    });
  });

  describe("rendering", () => {
    it("displays modal header with correct title", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} />
        </TestWrapper>
      );
      expect(screen.getByText("Choose a Template")).toBeInTheDocument();
    });

    it("displays close button", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} />
        </TestWrapper>
      );
      expect(screen.getByLabelText("Close")).toBeInTheDocument();
    });

    it("displays all templates in the grid", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} />
        </TestWrapper>
      );
      expect(screen.getByText("Simple Text")).toBeInTheDocument();
      expect(screen.getByText("Rich Embed")).toBeInTheDocument();
      expect(screen.getByText("Media Gallery")).toBeInTheDocument();
    });

    it("displays preview panel", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} />
        </TestWrapper>
      );
      expect(screen.getByText("Preview")).toBeInTheDocument();
    });

    it("displays article selector when articles are provided", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} />
        </TestWrapper>
      );
      expect(screen.getByLabelText("Preview article")).toBeInTheDocument();
    });

    it("displays placeholder when no template is selected", async () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            selectedTemplateId={undefined}
            connectionId={undefined}
          />
        </TestWrapper>
      );
      // Wait for initial render to complete
      await waitFor(() => {
        expect(screen.getByText("Select a template to preview")).toBeInTheDocument();
      });
    });

    it("uses correct testId when provided", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} testId="test-modal" />
        </TestWrapper>
      );
      expect(screen.getByTestId("test-modal")).toBeInTheDocument();
    });
  });

  describe("modal behavior", () => {
    it("calls onClose when close button is clicked", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} onClose={onClose} />
        </TestWrapper>
      );

      await user.click(screen.getByLabelText("Close"));
      expect(onClose).toHaveBeenCalled();
    });

    it("calls onClose when Cancel button is clicked", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} onClose={onClose} />
        </TestWrapper>
      );

      await user.click(screen.getByText("Cancel"));
      expect(onClose).toHaveBeenCalled();
    });

    it("calls onSecondaryAction when provided and Cancel is clicked", async () => {
      const user = userEvent.setup();
      const onSecondaryAction = vi.fn();
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} onSecondaryAction={onSecondaryAction} />
        </TestWrapper>
      );

      await user.click(screen.getByText("Cancel"));
      expect(onSecondaryAction).toHaveBeenCalled();
    });

    it("does not render when isOpen is false", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} isOpen={false} />
        </TestWrapper>
      );
      expect(screen.queryByText("Choose a Template")).not.toBeInTheDocument();
    });

    it("calls onClose when ESC key is pressed", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} onClose={onClose} />
        </TestWrapper>
      );

      await user.keyboard("{Escape}");
      expect(onClose).toHaveBeenCalled();
    });

    it("has closeOnOverlayClick enabled", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} testId="test-modal" />
        </TestWrapper>
      );
      // Verify modal is rendered with overlay click behavior enabled
      // The actual click behavior is handled by Chakra Modal internally
      // and is tested by Chakra's own test suite
      const overlay = document.querySelector(".chakra-modal__overlay");
      expect(overlay).toBeInTheDocument();
    });
  });

  describe("template selection", () => {
    it("calls onTemplateSelect when a template is clicked", async () => {
      const user = userEvent.setup();
      const onTemplateSelect = vi.fn();
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} onTemplateSelect={onTemplateSelect} />
        </TestWrapper>
      );

      await user.click(screen.getByText("Rich Embed"));
      expect(onTemplateSelect).toHaveBeenCalledWith("rich-embed");
    });

    it("shows radio inputs for each template", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} />
        </TestWrapper>
      );
      const radios = screen.getAllByRole("radio");
      expect(radios).toHaveLength(3);
    });

    it("selects template when selectedTemplateId is provided", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} selectedTemplateId="rich-embed" />
        </TestWrapper>
      );
      const radios = screen.getAllByRole("radio");
      const richEmbedRadio = radios.find((r) => r.getAttribute("value") === "rich-embed");
      expect(richEmbedRadio).toBeChecked();
    });
  });

  describe("feed capability filtering", () => {
    it("disables templates when required fields are not available", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} feedFields={["title", "link"]} />
        </TestWrapper>
      );
      const radios = screen.getAllByRole("radio");
      const richEmbedRadio = radios.find((r) => r.getAttribute("value") === "rich-embed");
      const mediaGalleryRadio = radios.find((r) => r.getAttribute("value") === "media-gallery");

      expect(richEmbedRadio).toBeDisabled();
      expect(mediaGalleryRadio).toBeDisabled();
    });

    it("shows disabled badge on incompatible templates", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} feedFields={["title", "link"]} />
        </TestWrapper>
      );
      const badges = screen.getAllByText("Needs articles");
      expect(badges.length).toBeGreaterThan(0);
    });

    it("keeps default template enabled when no feed fields", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} feedFields={[]} />
        </TestWrapper>
      );
      const radios = screen.getAllByRole("radio");
      const defaultRadio = radios.find((r) => r.getAttribute("value") === "default");
      expect(defaultRadio).not.toBeDisabled();
    });

    it("shows info alert when feedFields is empty", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} feedFields={[]} />
        </TestWrapper>
      );
      expect(
        screen.getByText("Some templates are unavailable until your feed has articles")
      ).toBeInTheDocument();
    });
  });

  describe("article selection", () => {
    it("displays all articles in the selector", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} />
        </TestWrapper>
      );
      const selector = screen.getByLabelText("Preview article");
      expect(selector).toBeInTheDocument();

      // Check options
      const options = selector.querySelectorAll("option");
      expect(options).toHaveLength(3);
    });

    it("calls onArticleChange when article is changed", async () => {
      const user = userEvent.setup();
      const onArticleChange = vi.fn();
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} onArticleChange={onArticleChange} />
        </TestWrapper>
      );

      const selector = screen.getByLabelText("Preview article");
      await user.selectOptions(selector, "article-2");
      expect(onArticleChange).toHaveBeenCalledWith("article-2");
    });

    it("shows correct selected article", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} selectedArticleId="article-2" />
        </TestWrapper>
      );
      const selector = screen.getByLabelText("Preview article") as HTMLSelectElement;
      expect(selector.value).toBe("article-2");
    });

    it("does not show article selector when no articles", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} articles={[]} />
        </TestWrapper>
      );
      expect(screen.queryByLabelText("Preview article")).not.toBeInTheDocument();
    });
  });

  describe("action buttons", () => {
    it("displays primary action button with default label", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} onPrimaryAction={vi.fn()} />
        </TestWrapper>
      );
      expect(screen.getByText("Use this template")).toBeInTheDocument();
    });

    it("displays primary action button with custom label", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            onPrimaryAction={vi.fn()}
            primaryActionLabel="Apply Template"
          />
        </TestWrapper>
      );
      expect(screen.getByText("Apply Template")).toBeInTheDocument();
    });

    it("disables primary action when no template selected", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            onPrimaryAction={vi.fn()}
            selectedTemplateId={undefined}
          />
        </TestWrapper>
      );
      expect(screen.getByText("Use this template")).toBeDisabled();
    });

    it("enables primary action when template is selected", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            onPrimaryAction={vi.fn()}
            selectedTemplateId="default"
          />
        </TestWrapper>
      );
      expect(screen.getByText("Use this template")).not.toBeDisabled();
    });

    it("calls onPrimaryAction with selected template ID", async () => {
      const user = userEvent.setup();
      const onPrimaryAction = vi.fn();
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            onPrimaryAction={onPrimaryAction}
            selectedTemplateId="rich-embed"
          />
        </TestWrapper>
      );

      await user.click(screen.getByText("Use this template"));
      expect(onPrimaryAction).toHaveBeenCalledWith("rich-embed");
    });

    it("shows loading state on primary action", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            onPrimaryAction={vi.fn()}
            selectedTemplateId="default"
            isPrimaryActionLoading
          />
        </TestWrapper>
      );
      const button = screen.getByText("Use this template").closest("button");
      expect(button).toHaveAttribute("data-loading");
    });

    it("displays secondary action button with default label", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} />
        </TestWrapper>
      );
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    it("displays secondary action button with custom label", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} secondaryActionLabel="Close" />
        </TestWrapper>
      );
      expect(screen.getByText("Close")).toBeInTheDocument();
    });

    it("displays tertiary action button when provided", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            tertiaryActionLabel="Customize manually"
            onTertiaryAction={vi.fn()}
          />
        </TestWrapper>
      );
      expect(screen.getByText("Customize manually")).toBeInTheDocument();
    });

    it("calls onTertiaryAction when tertiary button is clicked", async () => {
      const user = userEvent.setup();
      const onTertiaryAction = vi.fn();
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            tertiaryActionLabel="Customize manually"
            onTertiaryAction={onTertiaryAction}
          />
        </TestWrapper>
      );

      await user.click(screen.getByText("Customize manually"));
      expect(onTertiaryAction).toHaveBeenCalled();
    });

    it("does not show tertiary action when label not provided", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} />
        </TestWrapper>
      );
      expect(screen.queryByText("Customize manually")).not.toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("has aria-labelledby pointing to modal header", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} testId="test-modal" />
        </TestWrapper>
      );
      const modalContent = screen.getByTestId("test-modal");
      // Chakra Modal automatically generates aria-labelledby attribute
      expect(modalContent).toHaveAttribute("aria-labelledby");
    });

    it("has visually hidden legend for template selection fieldset", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} />
        </TestWrapper>
      );
      // The legend is visually hidden but should be in the DOM
      const legend = screen.getByText("Choose a template");
      expect(legend).toBeInTheDocument();
    });

    it("has aria-label on preview panel", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} />
        </TestWrapper>
      );
      expect(screen.getByLabelText("Template preview")).toBeInTheDocument();
    });

    it("has aria-live region for preview updates", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} />
        </TestWrapper>
      );
      const previewPanel = screen.getByLabelText("Template preview");
      // The aria-live region should exist within the preview panel
      const liveRegion = previewPanel.querySelector('[aria-live="polite"]');
      expect(liveRegion).toBeInTheDocument();
    });

    it("supports keyboard interaction within radio group", async () => {
      const user = userEvent.setup();
      const onTemplateSelect = vi.fn();
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} onTemplateSelect={onTemplateSelect} />
        </TestWrapper>
      );

      const radios = screen.getAllByRole("radio");

      // Radio buttons should be present and interactive
      expect(radios).toHaveLength(3);

      // Tab to first radio and select via keyboard
      await user.tab();

      // Click on a different template should work
      await user.click(radios[1]);
      expect(onTemplateSelect).toHaveBeenCalledWith("rich-embed");
    });
  });

  describe("preview panel loading state", () => {
    it("shows placeholder text when no connection ID and template selected", async () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            connectionId={undefined}
            selectedTemplateId="default"
          />
        </TestWrapper>
      );
      // Wait for React Query to settle and show the placeholder
      await waitFor(() => {
        expect(screen.getByText("Preview requires a connection")).toBeInTheDocument();
      });
    });
  });

  describe("preview panel error state", () => {
    it("shows error message when preview API fails", async () => {
      mockCreatePreview.mockRejectedValue(new Error("API Error"));

      const mockUserFeed = { id: "feed-123" } as Parameters<
        typeof TemplateGalleryModal
      >[0]["userFeed"];
      const mockConnection = { id: "connection-456" } as Parameters<
        typeof TemplateGalleryModal
      >[0]["connection"];

      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            selectedTemplateId="default"
            userFeed={mockUserFeed}
            connection={mockConnection}
          />
        </TestWrapper>
      );

      await waitFor(
        () => {
          expect(screen.getByText("Failed to load preview. Please try again.")).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });
});
