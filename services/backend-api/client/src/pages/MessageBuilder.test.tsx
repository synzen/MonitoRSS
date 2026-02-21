import React from "react";
import { describe, it, expect, vi } from "vitest";
import { TEMPLATES, getTemplateById, DEFAULT_TEMPLATE } from "../features/templates/constants";
import { TemplateRequiredField } from "../features/templates/types";
import { createDetectedFields } from "../features/templates/utils/detectedFieldsTestUtils";
import { ComponentType } from "./MessageBuilder/types";

vi.mock("../features/discordUser", () => ({
  useDiscordBot: () => ({
    data: { result: { avatar: null, username: "TestBot" } },
    status: "success",
    error: null,
  }),
  useDiscordUserMe: () => ({
    data: { iconUrl: null, username: "TestUser", id: "123" },
  }),
}));

vi.mock("../features/feed/hooks", () => ({
  useUserFeedArticles: () => ({
    data: {
      result: {
        articles: [
          {
            id: "article-1",
            title: "Test Article",
            description: "Test description",
            image: "test.jpg",
          },
        ],
      },
    },
    status: "success",
  }),
}));

vi.mock("../features/feedConnections", () => ({
  useUpdateDiscordChannelConnection: () => ({
    mutateAsync: vi.fn(),
    status: "idle",
  }),
}));

vi.mock("../contexts/UserFeedContext", () => ({
  UserFeedProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("../contexts/UserFeedConnectionContext", () => ({
  UserFeedConnectionProvider: ({ children }: { children: React.ReactNode }) => children,
  useUserFeedConnectionContext: () => ({
    userFeed: { id: "feed-123", title: "Test Feed", formatOptions: {} },
    connection: { id: "conn-456", name: "Test Connection" },
  }),
}));

vi.mock("./MessageBuilder/MessageBuilderContext", () => ({
  MessageBuilderProvider: ({ children }: { children: React.ReactNode }) => children,
  useMessageBuilderContext: () => ({
    resetMessage: vi.fn(),
  }),
}));

vi.mock("../hooks", () => ({
  useMessageBuilderTour: () => ({
    resetTour: vi.fn(),
    resetTrigger: 0,
  }),
  useIsMessageBuilderDesktop: () => true,
}));

vi.mock("../features/templates/components/TemplateGalleryModal", () => ({
  TemplateGalleryModal: vi.fn(({ onPrimaryAction, selectedTemplateId, isOpen }) => {
    if (!isOpen) return null;

    return (
      <div data-testid="template-gallery-modal">
        <button
          type="button"
          data-testid="apply-template-button"
          onClick={() => selectedTemplateId && onPrimaryAction?.(selectedTemplateId)}
        >
          Use this template
        </button>
      </div>
    );
  }),
}));

const defaultDetectedFields = createDetectedFields({
  [TemplateRequiredField.Image]: [{ field: "image", presentInAll: true }],
  [TemplateRequiredField.Description]: [{ field: "description", presentInAll: true }],
  [TemplateRequiredField.Title]: [{ field: "title", presentInAll: true }],
  [TemplateRequiredField.Author]: [{ field: "author", presentInAll: true }],
  [TemplateRequiredField.Link]: [{ field: "link", presentInAll: true }],
});

describe("MessageBuilder Template Application", () => {
  describe("handleApplyTemplate function", () => {
    it("applies template messageComponent to form via setValue", () => {
      const setValue = vi.fn();

      const handleApplyTemplate = (selectedId: string) => {
        const template = getTemplateById(selectedId) || DEFAULT_TEMPLATE;
        const newMessageComponent = template.createMessageComponent(defaultDetectedFields);

        setValue("messageComponent", newMessageComponent, {
          shouldValidate: true,
          shouldDirty: true,
          shouldTouch: true,
        });
      };

      handleApplyTemplate("rich-embed");

      expect(setValue).toHaveBeenCalledWith(
        "messageComponent",
        expect.objectContaining({
          type: ComponentType.V2Root,
          id: expect.any(String),
        }),
        { shouldValidate: true, shouldDirty: true, shouldTouch: true }
      );
    });

    it("uses DEFAULT_TEMPLATE when templateId not found", () => {
      const setValue = vi.fn();

      const handleApplyTemplate = (selectedId: string) => {
        const template = getTemplateById(selectedId) || DEFAULT_TEMPLATE;
        const newMessageComponent = template.createMessageComponent(defaultDetectedFields);

        setValue("messageComponent", newMessageComponent, {
          shouldValidate: true,
          shouldDirty: true,
          shouldTouch: true,
        });
      };

      handleApplyTemplate("non-existent-id");

      expect(setValue).toHaveBeenCalledWith(
        "messageComponent",
        expect.objectContaining({
          type: ComponentType.LegacyRoot,
          id: "default-root",
          name: "Simple Text Template",
        }),
        expect.any(Object)
      );
    });

    it("creates V2 messageComponent for compact-card template", () => {
      const setValue = vi.fn();

      const handleApplyTemplate = (selectedId: string) => {
        const template = getTemplateById(selectedId) || DEFAULT_TEMPLATE;
        const newMessageComponent = template.createMessageComponent(defaultDetectedFields);

        setValue("messageComponent", newMessageComponent, {
          shouldValidate: true,
          shouldDirty: true,
          shouldTouch: true,
        });
      };

      handleApplyTemplate("compact-card");

      expect(setValue).toHaveBeenCalledWith(
        "messageComponent",
        expect.objectContaining({
          type: ComponentType.V2Root,
        }),
        expect.any(Object)
      );
    });

    it("passes detected image field to createMessageComponent", () => {
      const setValue = vi.fn();
      const detectedFields = createDetectedFields({
        [TemplateRequiredField.Image]: [{ field: "thumbnail_url", presentInAll: true }],
        [TemplateRequiredField.Description]: [{ field: "description", presentInAll: true }],
        [TemplateRequiredField.Title]: [{ field: "title", presentInAll: true }],
        [TemplateRequiredField.Author]: [{ field: "author", presentInAll: true }],
        [TemplateRequiredField.Link]: [{ field: "link", presentInAll: true }],
      });

      const handleApplyTemplate = (selectedId: string) => {
        const template = getTemplateById(selectedId) || DEFAULT_TEMPLATE;
        const newMessageComponent = template.createMessageComponent(detectedFields);

        setValue("messageComponent", newMessageComponent, {
          shouldValidate: true,
          shouldDirty: true,
          shouldTouch: true,
        });
      };

      handleApplyTemplate("rich-embed");

      expect(setValue).toHaveBeenCalled();
      const messageComponent = setValue.mock.calls[0][1];
      const thumbnailChild = JSON.stringify(messageComponent);
      expect(thumbnailChild).toContain("thumbnail_url");
    });
  });

  describe("getTemplateById utility", () => {
    it("returns correct template for valid ID", () => {
      const template = getTemplateById("rich-embed");
      expect(template).toBeDefined();
      expect(template?.id).toBe("rich-embed");
      expect(template?.name).toBe("Rich Embed");
    });

    it("returns undefined for invalid ID", () => {
      const template = getTemplateById("non-existent");
      expect(template).toBeUndefined();
    });

    it("returns all expected templates", () => {
      expect(getTemplateById("default")).toBeDefined();
      expect(getTemplateById("rich-embed")).toBeDefined();
      expect(getTemplateById("compact-card")).toBeDefined();
      expect(getTemplateById("media-gallery")).toBeDefined();
    });
  });

  describe("DEFAULT_TEMPLATE", () => {
    it("creates a valid LegacyRoot messageComponent", () => {
      const messageComponent = DEFAULT_TEMPLATE.createMessageComponent();
      expect(messageComponent.type).toBe(ComponentType.LegacyRoot);
      expect(messageComponent.id).toBe("default-root");
    });

    it("has no required fields", () => {
      expect(DEFAULT_TEMPLATE.requiredFields).toEqual([]);
    });
  });

  describe("Template createMessageComponent", () => {
    it("each template creates valid messageComponent with unique IDs", () => {
      TEMPLATES.forEach((template) => {
        const messageComponent = template.createMessageComponent();
        expect(messageComponent.id).toBeDefined();
        expect(messageComponent.type).toBeDefined();
        expect([ComponentType.LegacyRoot, ComponentType.V2Root]).toContain(messageComponent.type);
      });
    });

    it("templates with image use the passed imageField parameter", () => {
      const richEmbed = getTemplateById("rich-embed")!;
      const customFields = createDetectedFields({
        [TemplateRequiredField.Image]: [{ field: "custom_image_field", presentInAll: true }],
        [TemplateRequiredField.Description]: [{ field: "description", presentInAll: true }],
        [TemplateRequiredField.Title]: [{ field: "title", presentInAll: true }],
        [TemplateRequiredField.Author]: [{ field: "author", presentInAll: true }],
        [TemplateRequiredField.Link]: [{ field: "link", presentInAll: true }],
      });
      const messageComponent = richEmbed.createMessageComponent(customFields);

      const jsonStr = JSON.stringify(messageComponent);
      expect(jsonStr).toContain("custom_image_field");
    });
  });
});
