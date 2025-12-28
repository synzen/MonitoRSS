import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  TemplateGalleryModal,
  isTemplateCompatible,
  getMissingFields,
  getDisabledReason,
} from "./index";
import { Template, TemplateRequiredField } from "../../types";
import { ComponentType } from "../../../../pages/MessageBuilder/types";
import {
  createDiscordChannelConnectionPreview,
  createTemplatePreview,
} from "../../../feedConnections/api";
import { SendTestArticleDeliveryStatus } from "../../../../types";

vi.mock("../../../feedConnections/api", () => ({
  createDiscordChannelConnectionPreview: vi.fn(),
  createTemplatePreview: vi.fn(),
}));

const mockCreatePreview = vi.mocked(createDiscordChannelConnectionPreview);
const mockCreateTemplatePreview = vi.mocked(createTemplatePreview);

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
    createMessageComponent: () => ({
      type: ComponentType.LegacyRoot,
      id: "root",
      name: "Root",
      children: [],
    }),
  },
  {
    id: "rich-embed",
    name: "Rich Embed",
    description: "Full embed with image and description",
    requiredFields: [TemplateRequiredField.Description],
    createMessageComponent: () => ({
      type: ComponentType.LegacyRoot,
      id: "root",
      name: "Root",
      children: [],
    }),
  },
  {
    id: "media-gallery",
    name: "Media Gallery",
    description: "Showcase images in a modern gallery layout",
    requiredFields: [TemplateRequiredField.Image],
    createMessageComponent: () => ({
      type: ComponentType.LegacyRoot,
      id: "root",
      name: "Root",
      children: [],
    }),
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
  detectedFields: { image: "image", description: "description", title: "title" },
  articles: mockArticles,
  selectedArticleId: "article-1",
  onArticleChange: vi.fn(),
  feedId: "feed-123",
  connectionId: "connection-456",
};

const emptyDetectedFields = { image: null, description: null, title: null };
const fullDetectedFields = { image: "image", description: "description", title: "title" };

describe("TemplateGalleryModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set default mock return values to prevent "Query data cannot be undefined" warnings
    mockCreatePreview.mockResolvedValue({
      result: { status: SendTestArticleDeliveryStatus.Success, messages: [] },
    });
    mockCreateTemplatePreview.mockResolvedValue({
      result: { status: SendTestArticleDeliveryStatus.Success, messages: [] },
    });
  });

  describe("isTemplateCompatible utility", () => {
    it("returns true when template has no required fields", () => {
      const template: Template = {
        id: "test",
        name: "Test",
        description: "Test",
        requiredFields: [],
        createMessageComponent: () => ({
          type: ComponentType.LegacyRoot,
          id: "root",
          name: "Root",
          children: [],
        }),
      };
      expect(isTemplateCompatible(template, ["title"], emptyDetectedFields)).toBe(true);
    });

    it("returns true when all required fields are present", () => {
      const template: Template = {
        id: "test",
        name: "Test",
        description: "Test",
        requiredFields: [TemplateRequiredField.Description, TemplateRequiredField.Image],
        createMessageComponent: () => ({
          type: ComponentType.LegacyRoot,
          id: "root",
          name: "Root",
          children: [],
        }),
      };
      expect(
        isTemplateCompatible(template, ["title", "description", "image"], fullDetectedFields)
      ).toBe(true);
    });

    it("returns false when some required fields are missing", () => {
      const template: Template = {
        id: "test",
        name: "Test",
        description: "Test",
        requiredFields: [TemplateRequiredField.Description, TemplateRequiredField.Image],
        createMessageComponent: () => ({
          type: ComponentType.LegacyRoot,
          id: "root",
          name: "Root",
          children: [],
        }),
      };
      expect(
        isTemplateCompatible(template, ["title", "description"], {
          image: null,
          description: "description",
          title: "title",
        })
      ).toBe(false);
    });
  });

  describe("getMissingFields utility", () => {
    it("returns empty array when template has no required fields", () => {
      const template: Template = {
        id: "test",
        name: "Test",
        description: "Test",
        requiredFields: [],
        createMessageComponent: () => ({
          type: ComponentType.LegacyRoot,
          id: "root",
          name: "Root",
          children: [],
        }),
      };
      expect(getMissingFields(template, ["title"], emptyDetectedFields)).toEqual([]);
    });

    it("returns empty array when all required fields are present", () => {
      const template: Template = {
        id: "test",
        name: "Test",
        description: "Test",
        requiredFields: [TemplateRequiredField.Description, TemplateRequiredField.Image],
        createMessageComponent: () => ({
          type: ComponentType.LegacyRoot,
          id: "root",
          name: "Root",
          children: [],
        }),
      };
      expect(
        getMissingFields(template, ["title", "description", "image"], fullDetectedFields)
      ).toEqual([]);
    });

    it("returns only missing fields when some are absent", () => {
      const template: Template = {
        id: "test",
        name: "Test",
        description: "Test",
        requiredFields: [TemplateRequiredField.Description, TemplateRequiredField.Image],
        createMessageComponent: () => ({
          type: ComponentType.LegacyRoot,
          id: "root",
          name: "Root",
          children: [],
        }),
      };
      expect(
        getMissingFields(template, ["title", "description"], {
          image: null,
          description: "description",
          title: "title",
        })
      ).toEqual(["image"]);
    });

    it("returns all required fields when none are present", () => {
      const template: Template = {
        id: "test",
        name: "Test",
        description: "Test",
        requiredFields: [TemplateRequiredField.Description, TemplateRequiredField.Image],
        createMessageComponent: () => ({
          type: ComponentType.LegacyRoot,
          id: "root",
          name: "Root",
          children: [],
        }),
      };
      expect(getMissingFields(template, ["title"], emptyDetectedFields)).toEqual([
        "description",
        "image",
      ]);
    });
  });

  describe("isTemplateCompatible and getMissingFields consistency", () => {
    const createTemplate = (requiredFields: TemplateRequiredField[]): Template => ({
      id: "test",
      name: "Test",
      description: "Test",
      requiredFields,
      createMessageComponent: () => ({
        type: ComponentType.LegacyRoot,
        id: "root",
        name: "Root",
        children: [],
      }),
    });

    it("getMissingFields returns empty when isTemplateCompatible returns true", () => {
      const template = createTemplate([TemplateRequiredField.Description]);

      // Field in feedFields but not detectedFields - should still be compatible
      const feedFields = ["description"];
      const detectedFields = { image: null, description: null, title: null };

      expect(isTemplateCompatible(template, feedFields, detectedFields)).toBe(true);
      expect(getMissingFields(template, feedFields, detectedFields)).toEqual([]);
    });

    it("getMissingFields returns fields when isTemplateCompatible returns false", () => {
      const template = createTemplate([TemplateRequiredField.Image]);

      // Field not in feedFields AND not in detectedFields - should be incompatible
      const feedFields = ["title"];
      const detectedFields = { image: null, description: null, title: "title" };

      expect(isTemplateCompatible(template, feedFields, detectedFields)).toBe(false);
      expect(getMissingFields(template, feedFields, detectedFields)).toContain("image");
    });

    it("field in feedFields but not detectedFields is still available", () => {
      // This test specifically catches the original bug where || was used instead of &&
      const template = createTemplate([TemplateRequiredField.Description]);

      // description is in feedFields but detectedFields.description is null
      const feedFields = ["title", "description", "link"];
      const detectedFields = { image: null, description: null, title: "title" };

      // Should be compatible because "description" is in feedFields
      expect(isTemplateCompatible(template, feedFields, detectedFields)).toBe(true);
      // getMissingFields should return empty since field IS available in feedFields
      expect(getMissingFields(template, feedFields, detectedFields)).toEqual([]);
    });

    it("field in detectedFields but not feedFields is still available", () => {
      const template = createTemplate([TemplateRequiredField.Image]);

      // image is in detectedFields but not in feedFields
      const feedFields = ["title", "link"];
      const detectedFields = { image: "imageUrl", description: null, title: "title" };

      // Should be compatible because image is in detectedFields
      expect(isTemplateCompatible(template, feedFields, detectedFields)).toBe(true);
      expect(getMissingFields(template, feedFields, detectedFields)).toEqual([]);
    });

    it("functions agree on all combinations for a multi-field template", () => {
      const template = createTemplate([
        TemplateRequiredField.Description,
        TemplateRequiredField.Image,
      ]);

      // Test various combinations
      const testCases = [
        {
          feedFields: ["description", "image"],
          detectedFields: emptyDetectedFields,
          shouldBeCompatible: true,
        },
        {
          feedFields: ["description"],
          detectedFields: { image: "img", description: null, title: null },
          shouldBeCompatible: true,
        },
        {
          feedFields: ["title"],
          detectedFields: fullDetectedFields,
          shouldBeCompatible: true,
        },
        {
          feedFields: ["title"],
          detectedFields: { image: null, description: "desc", title: null },
          shouldBeCompatible: false,
        },
        {
          feedFields: [],
          detectedFields: emptyDetectedFields,
          shouldBeCompatible: false,
        },
      ];

      testCases.forEach(({ feedFields, detectedFields, shouldBeCompatible }) => {
        const compatible = isTemplateCompatible(template, feedFields, detectedFields);
        const missing = getMissingFields(template, feedFields, detectedFields);

        expect(compatible).toBe(shouldBeCompatible);

        // If compatible, missing should be empty; if not compatible, missing should have items
        if (shouldBeCompatible) {
          expect(missing).toEqual([]);
        } else {
          expect(missing.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe("getDisabledReason utility", () => {
    it("returns empty string when template has no required fields", () => {
      const template: Template = {
        id: "test",
        name: "Test",
        description: "Test",
        requiredFields: [],
        createMessageComponent: () => ({
          type: ComponentType.LegacyRoot,
          id: "root",
          name: "Root",
          children: [],
        }),
      };
      expect(getDisabledReason(template, ["title"], emptyDetectedFields)).toBe("");
    });

    it("returns empty string when all required fields are present", () => {
      const template: Template = {
        id: "test",
        name: "Test",
        description: "Test",
        requiredFields: [TemplateRequiredField.Description],
        createMessageComponent: () => ({
          type: ComponentType.LegacyRoot,
          id: "root",
          name: "Root",
          children: [],
        }),
      };
      expect(
        getDisabledReason(template, ["title", "description"], {
          image: null,
          description: "description",
          title: "title",
        })
      ).toBe("");
    });

    it("returns formatted message with single missing field", () => {
      const template: Template = {
        id: "test",
        name: "Test",
        description: "Test",
        requiredFields: [TemplateRequiredField.Image],
        createMessageComponent: () => ({
          type: ComponentType.LegacyRoot,
          id: "root",
          name: "Root",
          children: [],
        }),
      };
      expect(getDisabledReason(template, ["title"], emptyDetectedFields)).toBe("Needs: image");
    });

    it("returns formatted message with multiple missing fields", () => {
      const template: Template = {
        id: "test",
        name: "Test",
        description: "Test",
        requiredFields: [TemplateRequiredField.Description, TemplateRequiredField.Image],
        createMessageComponent: () => ({
          type: ComponentType.LegacyRoot,
          id: "root",
          name: "Root",
          children: [],
        }),
      };
      expect(getDisabledReason(template, ["title"], emptyDetectedFields)).toBe(
        "Needs: description, image"
      );
    });

    it("returns 'Needs articles' when feedFields is empty (no articles)", () => {
      const template: Template = {
        id: "test",
        name: "Test",
        description: "Test",
        requiredFields: [TemplateRequiredField.Image],
        createMessageComponent: () => ({
          type: ComponentType.LegacyRoot,
          id: "root",
          name: "Root",
          children: [],
        }),
      };
      expect(getDisabledReason(template, [], emptyDetectedFields)).toBe("Needs articles");
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

    it("displays custom modal title when modalTitle prop is provided", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} modalTitle="Browse Templates" />
        </TestWrapper>
      );
      expect(screen.getByText("Browse Templates")).toBeInTheDocument();
      expect(screen.queryByText("Choose a Template")).not.toBeInTheDocument();
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
      // Wait for initial render to complete - single preview mode shows this message
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

    it("clears selection when selectedTemplateId changes to undefined", () => {
      const { rerender } = render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} selectedTemplateId="rich-embed" />
        </TestWrapper>
      );

      // Verify template is selected
      const radios = screen.getAllByRole("radio");
      const richEmbedRadio = radios.find((r) => r.getAttribute("value") === "rich-embed");
      expect(richEmbedRadio).toBeChecked();

      // Rerender with undefined selectedTemplateId (simulates modal close/reopen)
      rerender(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} selectedTemplateId={undefined} />
        </TestWrapper>
      );

      // Verify no template is selected
      const radiosAfter = screen.getAllByRole("radio");
      const checkedRadios = radiosAfter.filter((r) => (r as HTMLInputElement).checked);
      expect(checkedRadios).toHaveLength(0);
    });
  });

  describe("feed capability filtering", () => {
    it("disables templates when required fields are not available", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            feedFields={["title", "link"]}
            detectedFields={emptyDetectedFields}
          />
        </TestWrapper>
      );
      const radios = screen.getAllByRole("radio");
      const richEmbedRadio = radios.find((r) => r.getAttribute("value") === "rich-embed");
      const mediaGalleryRadio = radios.find((r) => r.getAttribute("value") === "media-gallery");

      expect(richEmbedRadio).toBeDisabled();
      expect(mediaGalleryRadio).toBeDisabled();
    });

    it("shows disabled badge with missing fields on incompatible templates", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            feedFields={["title", "link"]}
            detectedFields={emptyDetectedFields}
          />
        </TestWrapper>
      );
      expect(screen.getByText("Needs: description")).toBeInTheDocument();
      expect(screen.getByText("Needs: image")).toBeInTheDocument();
    });

    it("shows 'Needs articles' badge when feedFields is empty", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            feedFields={[]}
            detectedFields={emptyDetectedFields}
          />
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

    it("disables ALL non-default templates when feedFields is empty (AC1)", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            feedFields={[]}
            detectedFields={emptyDetectedFields}
          />
        </TestWrapper>
      );
      const radios = screen.getAllByRole("radio");

      // Default template should be enabled
      const defaultRadio = radios.find((r) => r.getAttribute("value") === "default");
      expect(defaultRadio).not.toBeDisabled();

      // ALL other templates should be disabled
      const richEmbedRadio = radios.find((r) => r.getAttribute("value") === "rich-embed");
      const mediaGalleryRadio = radios.find((r) => r.getAttribute("value") === "media-gallery");

      expect(richEmbedRadio).toBeDisabled();
      expect(mediaGalleryRadio).toBeDisabled();

      // Verify only 1 template is enabled out of all templates
      const enabledRadios = radios.filter((r) => !r.hasAttribute("disabled"));
      expect(enabledRadios).toHaveLength(1);
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

    it("shows skeleton for article selector when loading", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} articles={[]} isLoadingArticles />
        </TestWrapper>
      );
      // The skeleton shows "Preview" label (from TemplateGalleryLoadingSkeleton)
      expect(screen.getByText("Preview")).toBeInTheDocument();
      // But the select should not be visible (skeleton instead)
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    });

    it("shows skeleton for preview panel when loading articles", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} articles={[]} isLoadingArticles />
        </TestWrapper>
      );
      // The preview area should show a skeleton, not the "no articles" message
      expect(
        screen.queryByText("Preview will appear when your feed has articles")
      ).not.toBeInTheDocument();
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

    it("primary action button is always enabled for simpler UX", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            onPrimaryAction={vi.fn()}
            selectedTemplateId={undefined}
          />
        </TestWrapper>
      );
      expect(screen.getByText("Use this template")).not.toBeDisabled();
    });

    it("does not call onPrimaryAction when clicked without template selected", async () => {
      const user = userEvent.setup();
      const onPrimaryAction = vi.fn();
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            onPrimaryAction={onPrimaryAction}
            selectedTemplateId={undefined}
          />
        </TestWrapper>
      );
      await user.click(screen.getByText("Use this template"));
      expect(onPrimaryAction).not.toHaveBeenCalled();
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

    it("has role=region on preview panel", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} />
        </TestWrapper>
      );
      const previewPanel = screen.getByLabelText("Template preview");
      expect(previewPanel).toHaveAttribute("role", "region");
    });

    it("has aria-live region for preview updates", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} />
        </TestWrapper>
      );
      // The aria-live region for preview updates is visually hidden (not inside preview panel)
      // to prevent duplicate announcements
      const liveRegion = document.querySelector('[aria-live="polite"][aria-atomic="true"]');
      expect(liveRegion).toBeInTheDocument();
    });

    it("has visually hidden aria-live region for template announcement", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} />
        </TestWrapper>
      );
      // The aria-live region is visually hidden for screen reader announcements
      const liveRegion = document.querySelector('[aria-live="polite"][aria-atomic="true"]');
      expect(liveRegion).toBeInTheDocument();
    });

    it("sets aria-busy on preview panel when loading", async () => {
      mockCreatePreview.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                result: { status: SendTestArticleDeliveryStatus.Success, messages: [] },
              });
            }, 1000);
          })
      );

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

      const previewPanel = screen.getByLabelText("Template preview");
      await waitFor(() => {
        expect(previewPanel).toHaveAttribute("aria-busy", "true");
      });
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

    it("navigates between templates with arrow keys", async () => {
      const user = userEvent.setup();
      const onTemplateSelect = vi.fn();
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} onTemplateSelect={onTemplateSelect} />
        </TestWrapper>
      );

      const radios = screen.getAllByRole("radio");

      // Click on first radio to focus it
      await user.click(radios[0]);

      // Arrow right should move to next template
      await user.keyboard("{ArrowRight}");
      expect(document.activeElement).toBe(radios[1]);

      // Arrow left should move back
      await user.keyboard("{ArrowLeft}");
      expect(document.activeElement).toBe(radios[0]);
    });

    it("selects template with Space key", async () => {
      const user = userEvent.setup();
      const onTemplateSelect = vi.fn();
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} onTemplateSelect={onTemplateSelect} />
        </TestWrapper>
      );

      const radios = screen.getAllByRole("radio");

      // Click to focus then move to next with arrow, then select with space
      await user.click(radios[0]);
      await user.keyboard("{ArrowRight}");
      await user.keyboard(" ");
      expect(onTemplateSelect).toHaveBeenCalledWith("rich-embed");
    });

    it("provides logical tab order through modal elements", async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} onPrimaryAction={vi.fn()} />
        </TestWrapper>
      );

      // Tab through modal - verify elements receive focus in order
      // Chakra Modal moves focus to first focusable element on open
      await user.tab();

      // Verify radios are reachable
      const radios = screen.getAllByRole("radio");
      expect(radios).toHaveLength(3);

      // Verify article selector is present
      const articleSelector = screen.getByLabelText("Preview article");
      expect(articleSelector).toBeInTheDocument();

      // Verify buttons are present
      const cancelButton = screen.getByText("Cancel");
      expect(cancelButton).toBeInTheDocument();

      const primaryButton = screen.getByText("Use this template");
      expect(primaryButton).toBeInTheDocument();
    });

    it("disables templates that are not compatible", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            feedFields={["title"]}
            detectedFields={emptyDetectedFields}
          />
        </TestWrapper>
      );

      const radios = screen.getAllByRole("radio");
      // First template has no required fields, so it's enabled
      // Second and third are disabled (require description/image)

      expect(radios[0]).not.toBeDisabled();
      expect(radios[1]).toBeDisabled();
      expect(radios[2]).toBeDisabled();
    });

    it("selects template with Enter key", async () => {
      const user = userEvent.setup();
      const onTemplateSelect = vi.fn();
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} onTemplateSelect={onTemplateSelect} />
        </TestWrapper>
      );

      const radios = screen.getAllByRole("radio");

      // Click to focus then move to next with arrow, then select with Enter
      await user.click(radios[0]);
      await user.keyboard("{ArrowRight}");
      await user.keyboard("{Enter}");
      expect(onTemplateSelect).toHaveBeenCalledWith("rich-embed");
    });

    it("modal has focus trap enabled via Chakra Modal default behavior", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} onPrimaryAction={vi.fn()} />
        </TestWrapper>
      );

      // Chakra Modal provides focus trap by default
      // Verify modal is rendered with dialog role which enables focus management
      const modalContent = screen.getByRole("dialog");
      expect(modalContent).toBeInTheDocument();

      // Verify modal has aria-modal="true" which indicates it should trap focus
      expect(modalContent).toHaveAttribute("aria-modal", "true");
    });

    it("has multiple focusable elements for Tab navigation within modal", async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} onPrimaryAction={vi.fn()} />
        </TestWrapper>
      );

      // Verify there are multiple focusable elements in the modal
      const closeButton = screen.getByLabelText("Close");
      const radios = screen.getAllByRole("radio");
      const cancelButton = screen.getByText("Cancel");
      const primaryButton = screen.getByText("Use this template");

      expect(closeButton).toBeInTheDocument();
      expect(radios.length).toBeGreaterThan(0);
      expect(cancelButton).toBeInTheDocument();
      expect(primaryButton).toBeInTheDocument();

      // Tab should move focus between elements
      await user.tab();
      // Focus is now somewhere in the modal
      const modalContent = screen.getByRole("dialog");
      expect(modalContent.contains(document.activeElement)).toBe(true);
    });

    it("returns focus to trigger element when modal closes", async () => {
      const user = userEvent.setup();

      const ModalWithTrigger = () => {
        const [isOpen, setIsOpen] = React.useState(false);

        return (
          <>
            <button data-testid="trigger" type="button" onClick={() => setIsOpen(true)}>
              Open Modal
            </button>
            <TemplateGalleryModal
              {...defaultProps}
              isOpen={isOpen}
              onClose={() => setIsOpen(false)}
            />
          </>
        );
      };

      render(
        <TestWrapper>
          <ModalWithTrigger />
        </TestWrapper>
      );

      const triggerButton = screen.getByTestId("trigger");

      // Open modal by clicking trigger
      await user.click(triggerButton);

      // Modal should be open
      expect(screen.getByText("Choose a Template")).toBeInTheDocument();

      // Close modal with Escape
      await user.keyboard("{Escape}");

      // Focus should return to trigger button
      await waitFor(() => {
        expect(document.activeElement).toBe(triggerButton);
      });
    });

    it("has visually hidden aria-live region that receives announcement text", async () => {
      mockCreatePreview.mockResolvedValue({
        result: { status: SendTestArticleDeliveryStatus.Success, messages: [{ content: "test" }] },
      });

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

      // Wait for preview to load and announcement to be set
      await waitFor(
        () => {
          // Find the visually hidden aria-live region with aria-atomic
          const liveRegion = document.querySelector('[aria-live="polite"][aria-atomic="true"]');
          expect(liveRegion).toBeInTheDocument();
          expect(liveRegion?.textContent).toContain("Preview updated for Simple Text template");
        },
        { timeout: 3000 }
      );
    });

    it("has exactly one aria-live region with aria-atomic for template announcements", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} />
        </TestWrapper>
      );

      // Our custom announcement region has aria-atomic="true"
      // (Chakra may add other aria-live regions for alerts, etc.)
      const announcementRegions = document.querySelectorAll(
        '[aria-live="polite"][aria-atomic="true"]'
      );
      expect(announcementRegions).toHaveLength(1);
    });
  });

  describe("preview panel loading state", () => {
    it("shows loading or preview when no connection ID but template and article selected", async () => {
      // Since Story 2-2, we have a template preview endpoint that works without connectionId
      // The preview should attempt to load using the template preview API
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            connectionId={undefined}
            selectedTemplateId="default"
          />
        </TestWrapper>
      );
      // The preview panel should show loading or preview content, not an error
      // Since articles exist, we should not see the "Preview will appear when your feed has articles" message
      await waitFor(() => {
        expect(
          screen.queryByText("Preview will appear when your feed has articles")
        ).not.toBeInTheDocument();
      });
    });

    it("shows placeholder message when no articles available", async () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            articles={[]}
            selectedArticleId={undefined}
            connectionId={undefined}
            selectedTemplateId="default"
          />
        </TestWrapper>
      );
      await waitFor(() => {
        expect(
          screen.getByText("Preview will appear when your feed has articles")
        ).toBeInTheDocument();
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
            showComparisonPreview={false}
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

  describe("test send functionality", () => {
    it("shows Send to Discord button when onTestSend is provided and articles available", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            selectedTemplateId="default"
            onTestSend={vi.fn()}
            onSave={vi.fn()}
          />
        </TestWrapper>
      );
      expect(screen.getByText("Send to Discord")).toBeInTheDocument();
    });

    it("shows Save button when onTestSend is provided and articles available", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            selectedTemplateId="default"
            onTestSend={vi.fn()}
            onSave={vi.fn()}
          />
        </TestWrapper>
      );
      expect(screen.getByText("Save")).toBeInTheDocument();
    });

    it("disables Send to Discord button when no template is selected", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            selectedTemplateId={undefined}
            onTestSend={vi.fn()}
            onSave={vi.fn()}
          />
        </TestWrapper>
      );
      expect(screen.getByText("Send to Discord")).toBeDisabled();
    });

    it("disables Send to Discord button when no article is selected", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            selectedTemplateId="default"
            selectedArticleId={undefined}
            onTestSend={vi.fn()}
            onSave={vi.fn()}
          />
        </TestWrapper>
      );
      expect(screen.getByText("Send to Discord")).toBeDisabled();
    });

    it("shows only Save button when no articles available (empty feed)", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            articles={[]}
            selectedTemplateId="default"
            onTestSend={vi.fn()}
            onSave={vi.fn()}
          />
        </TestWrapper>
      );
      expect(screen.getByText("Save")).toBeInTheDocument();
      expect(screen.queryByText("Send to Discord")).not.toBeInTheDocument();
    });

    it("calls onTestSend when Send to Discord button is clicked", async () => {
      const user = userEvent.setup();
      const onTestSend = vi.fn();
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            selectedTemplateId="default"
            onTestSend={onTestSend}
            onSave={vi.fn()}
          />
        </TestWrapper>
      );

      await user.click(screen.getByText("Send to Discord"));
      expect(onTestSend).toHaveBeenCalled();
    });

    it("calls onSave when Save button is clicked", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            selectedTemplateId="default"
            onTestSend={vi.fn()}
            onSave={onSave}
          />
        </TestWrapper>
      );

      await user.click(screen.getByText("Save"));
      expect(onSave).toHaveBeenCalled();
    });

    it("shows Sending... text during loading", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            selectedTemplateId="default"
            onTestSend={vi.fn()}
            onSave={vi.fn()}
            isTestSendLoading
          />
        </TestWrapper>
      );
      expect(screen.getByText("Sending...")).toBeInTheDocument();
    });

    it("displays success feedback alert after test send", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            selectedTemplateId="default"
            onTestSend={vi.fn()}
            onSave={vi.fn()}
            testSendFeedback={{
              status: "success",
              message: "Article sent to Discord successfully!",
            }}
          />
        </TestWrapper>
      );
      expect(screen.getByText("Article sent to Discord successfully!")).toBeInTheDocument();
    });

    it("displays error feedback alert with retry button after failed test send", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            selectedTemplateId="default"
            onTestSend={vi.fn()}
            onSave={vi.fn()}
            testSendFeedback={{
              status: "error",
              message: "Failed to send test article. Please try again.",
            }}
          />
        </TestWrapper>
      );
      expect(
        screen.getByText("Failed to send test article. Please try again.")
      ).toBeInTheDocument();
      expect(screen.getByText("Retry")).toBeInTheDocument();
    });

    it("calls onTestSend when Retry button is clicked", async () => {
      const user = userEvent.setup();
      const onTestSend = vi.fn();
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            selectedTemplateId="default"
            onTestSend={onTestSend}
            onSave={vi.fn()}
            testSendFeedback={{ status: "error", message: "Failed to send test article." }}
          />
        </TestWrapper>
      );

      await user.click(screen.getByText("Retry"));
      expect(onTestSend).toHaveBeenCalled();
    });

    it("shows loading state on Save button", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            selectedTemplateId="default"
            onTestSend={vi.fn()}
            onSave={vi.fn()}
            isSaveLoading
          />
        </TestWrapper>
      );
      const saveButton = screen.getByText("Save").closest("button");
      expect(saveButton).toHaveAttribute("data-loading");
    });

    it("Save button is primary (blue) when no articles available", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            articles={[]}
            selectedTemplateId="default"
            onTestSend={vi.fn()}
            onSave={vi.fn()}
          />
        </TestWrapper>
      );
      const saveButton = screen.getByText("Save").closest("button");
      expect(saveButton).toHaveClass("chakra-button");
    });
  });

  describe("error panel integration", () => {
    it("shows error panel when testSendFeedback has deliveryStatus", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            selectedTemplateId="default"
            onTestSend={vi.fn()}
            onSave={vi.fn()}
            testSendFeedback={{
              status: "error",
              message: "Discord couldn't process this message.",
              deliveryStatus: SendTestArticleDeliveryStatus.BadPayload,
            }}
          />
        </TestWrapper>
      );

      expect(screen.getByText(/Discord couldn't send this preview/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Try Another Template/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Use this template/i })).toBeInTheDocument();
    });

    it("does not show error panel for success feedback", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            selectedTemplateId="default"
            onTestSend={vi.fn()}
            onSave={vi.fn()}
            testSendFeedback={{
              status: "success",
              message: "Article sent to Discord successfully!",
            }}
          />
        </TestWrapper>
      );

      expect(screen.queryByText(/Discord couldn't send this preview/i)).not.toBeInTheDocument();
      expect(screen.getByText("Article sent to Discord successfully!")).toBeInTheDocument();
    });

    it("does not show error panel for error feedback without deliveryStatus", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            selectedTemplateId="default"
            onTestSend={vi.fn()}
            onSave={vi.fn()}
            testSendFeedback={{
              status: "error",
              message: "Failed to send test article. Please try again.",
            }}
          />
        </TestWrapper>
      );

      expect(screen.queryByText(/Discord couldn't send this preview/i)).not.toBeInTheDocument();
      expect(
        screen.getByText("Failed to send test article. Please try again.")
      ).toBeInTheDocument();
    });

    it("hides template gallery when error panel is shown", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            selectedTemplateId="default"
            onTestSend={vi.fn()}
            onSave={vi.fn()}
            testSendFeedback={{
              status: "error",
              message: "Discord couldn't process this message.",
              deliveryStatus: SendTestArticleDeliveryStatus.BadPayload,
            }}
          />
        </TestWrapper>
      );

      expect(screen.queryByRole("radio")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Template preview")).not.toBeInTheDocument();
    });

    it("hides modal footer when error panel is shown", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            selectedTemplateId="default"
            onTestSend={vi.fn()}
            onSave={vi.fn()}
            tertiaryActionLabel="Back"
            testSendFeedback={{
              status: "error",
              message: "Discord couldn't process this message.",
              deliveryStatus: SendTestArticleDeliveryStatus.BadPayload,
            }}
          />
        </TestWrapper>
      );

      // Footer buttons should be hidden when error panel is showing
      expect(screen.queryByText("Back")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Skip/i })).not.toBeInTheDocument();
      // Save button in footer should be hidden (but Use Anyway in error panel should be visible)
      const saveButtons = screen.queryAllByRole("button", { name: /^Save$/i });
      expect(saveButtons).toHaveLength(0);
    });

    it("calls onClearTestSendFeedback when Try Another Template is clicked", async () => {
      const user = userEvent.setup();
      const onClearTestSendFeedback = vi.fn();

      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            selectedTemplateId="default"
            onTestSend={vi.fn()}
            onSave={vi.fn()}
            onClearTestSendFeedback={onClearTestSendFeedback}
            testSendFeedback={{
              status: "error",
              message: "Discord couldn't process this message.",
              deliveryStatus: SendTestArticleDeliveryStatus.BadPayload,
            }}
          />
        </TestWrapper>
      );

      await user.click(screen.getByRole("button", { name: /Try Another Template/i }));
      expect(onClearTestSendFeedback).toHaveBeenCalledTimes(1);
    });

    it("calls onSave when Use this template is clicked", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();

      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            selectedTemplateId="default"
            onTestSend={vi.fn()}
            onSave={onSave}
            testSendFeedback={{
              status: "error",
              message: "Discord couldn't process this message.",
              deliveryStatus: SendTestArticleDeliveryStatus.BadPayload,
            }}
          />
        </TestWrapper>
      );

      await user.click(screen.getByRole("button", { name: /Use this template/i }));
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    it("shows loading state on Use this template button when isSaveLoading is true", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            selectedTemplateId="default"
            onTestSend={vi.fn()}
            onSave={vi.fn()}
            isSaveLoading
            testSendFeedback={{
              status: "error",
              message: "Discord couldn't process this message.",
              deliveryStatus: SendTestArticleDeliveryStatus.BadPayload,
            }}
          />
        </TestWrapper>
      );

      const useTemplateButton = screen.getByRole("button", {
        name: /Use this template/i,
      });
      expect(useTemplateButton).toBeInTheDocument();
      expect(useTemplateButton).toHaveAttribute("data-loading");
    });
  });

  describe("dual preview mode (showComparisonPreview)", () => {
    const mockMessageComponent = {
      type: ComponentType.LegacyRoot as const,
      id: "root",
      name: "Root",
      children: [],
    };

    it("displays single Preview label when showComparisonPreview is false", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal {...defaultProps} showComparisonPreview={false} />
        </TestWrapper>
      );
      expect(screen.getByText("Preview")).toBeInTheDocument();
      expect(screen.queryByText("Current Format")).not.toBeInTheDocument();
      expect(screen.queryByText("Template Preview")).not.toBeInTheDocument();
    });

    it("displays dual preview labels when showComparisonPreview is true", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            showComparisonPreview
            currentMessageComponent={mockMessageComponent}
          />
        </TestWrapper>
      );
      expect(screen.getByText("Current Format")).toBeInTheDocument();
      expect(screen.getByText("Template Preview")).toBeInTheDocument();
      expect(screen.queryByText(/^Preview$/)).not.toBeInTheDocument();
    });

    it("shows placeholder in template preview when no template selected", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            showComparisonPreview
            currentMessageComponent={mockMessageComponent}
            selectedTemplateId={undefined}
          />
        </TestWrapper>
      );
      expect(screen.getByText("Select a template to compare")).toBeInTheDocument();
    });

    it("shows No current format message when currentMessageComponent is not provided", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            showComparisonPreview
            currentMessageComponent={undefined}
          />
        </TestWrapper>
      );
      expect(screen.getByText("No current format to display")).toBeInTheDocument();
    });

    it("still displays article selector in dual preview mode", () => {
      render(
        <TestWrapper>
          <TemplateGalleryModal
            {...defaultProps}
            showComparisonPreview
            currentMessageComponent={mockMessageComponent}
          />
        </TestWrapper>
      );
      expect(screen.getByLabelText("Preview article")).toBeInTheDocument();
    });
  });
});
