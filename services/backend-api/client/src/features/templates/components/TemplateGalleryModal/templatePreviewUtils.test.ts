import { describe, it, expect } from "vitest";
import { convertTemplateMessageComponentToPreviewInput } from "./templatePreviewUtils";
import {
  ComponentType,
  V2MessageComponentRoot,
  LegacyMessageComponentRoot,
} from "../../../../pages/MessageBuilder/types";
import { DiscordButtonStyle } from "../../../../pages/MessageBuilder/constants/DiscordButtonStyle";

describe("convertTemplateMessageComponentToPreviewInput", () => {
  describe("when messageComponent is undefined", () => {
    it("returns empty object", () => {
      const result = convertTemplateMessageComponentToPreviewInput(undefined);

      expect(result).toEqual({});
    });
  });

  describe("LegacyRoot templates", () => {
    it("extracts content from LegacyText child", () => {
      const messageComponent: LegacyMessageComponentRoot = {
        type: ComponentType.LegacyRoot,
        id: "root",
        name: "Root",
        children: [
          {
            type: ComponentType.LegacyText,
            id: "text",
            name: "Text",
            content: "**{{title}}**\n{{link}}",
          },
        ],
      };

      const result = convertTemplateMessageComponentToPreviewInput(messageComponent);

      expect(result.content).toBe("**{{title}}**\n{{link}}");
    });

    it("extracts embeds from LegacyEmbedContainer", () => {
      const messageComponent: LegacyMessageComponentRoot = {
        type: ComponentType.LegacyRoot,
        id: "root",
        name: "Root",
        children: [
          {
            type: ComponentType.LegacyEmbedContainer,
            id: "embed-container",
            name: "Embeds",
            children: [
              {
                type: ComponentType.LegacyEmbed,
                id: "embed",
                name: "Embed",
                color: 5814783,
                children: [
                  {
                    type: ComponentType.LegacyEmbedTitle,
                    id: "title",
                    name: "Title",
                    title: "{{title}}",
                    titleUrl: "{{link}}",
                  },
                  {
                    type: ComponentType.LegacyEmbedDescription,
                    id: "desc",
                    name: "Description",
                    description: "{{description}}",
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = convertTemplateMessageComponentToPreviewInput(messageComponent);

      expect(result.embeds).toBeDefined();
      expect(result.embeds?.length).toBe(1);
      expect(result.embeds?.[0].color).toBe("5814783");
      expect(result.embeds?.[0].title).toBe("{{title}}");
      expect(result.embeds?.[0].url).toBe("{{link}}");
      expect(result.embeds?.[0].description).toBe("{{description}}");
    });

    it("sets componentsV2 to null for legacy templates", () => {
      const messageComponent: LegacyMessageComponentRoot = {
        type: ComponentType.LegacyRoot,
        id: "root",
        name: "Root",
        children: [],
      };

      const result = convertTemplateMessageComponentToPreviewInput(messageComponent);

      expect(result.componentsV2).toBeNull();
    });

    it("includes placeholderLimits from template", () => {
      const messageComponent: LegacyMessageComponentRoot = {
        type: ComponentType.LegacyRoot,
        id: "root",
        name: "Root",
        children: [],
        placeholderLimits: [
          { placeholder: "description", characterCount: 100, appendString: "..." },
        ],
      };

      const result = convertTemplateMessageComponentToPreviewInput(messageComponent);

      expect(result.placeholderLimits).toEqual([
        { placeholder: "description", characterCount: 100, appendString: "..." },
      ]);
    });

    it("includes enablePlaceholderFallback from template", () => {
      const messageComponent: LegacyMessageComponentRoot = {
        type: ComponentType.LegacyRoot,
        id: "root",
        name: "Root",
        children: [],
        enablePlaceholderFallback: true,
      };

      const result = convertTemplateMessageComponentToPreviewInput(messageComponent);

      expect(result.enablePlaceholderFallback).toBe(true);
    });
  });

  describe("V2Root templates", () => {
    it("converts V2Container to componentsV2", () => {
      const messageComponent: V2MessageComponentRoot = {
        type: ComponentType.V2Root,
        id: "root",
        name: "Root",
        children: [
          {
            type: ComponentType.V2Container,
            id: "container",
            name: "Container",
            accentColor: 5814783,
            children: [
              {
                type: ComponentType.V2TextDisplay,
                id: "text",
                name: "Text",
                content: "**{{title}}**",
              },
            ],
          },
        ],
      };

      const result = convertTemplateMessageComponentToPreviewInput(messageComponent);

      expect(result.componentsV2).toBeDefined();
      expect(result.componentsV2?.length).toBe(1);
      const container = result.componentsV2?.[0] as Record<string, unknown>;
      expect(container.type).toBe("CONTAINER");
      expect(container.accent_color).toBe(5814783);
    });

    it("converts V2Section with thumbnail accessory", () => {
      const messageComponent: V2MessageComponentRoot = {
        type: ComponentType.V2Root,
        id: "root",
        name: "Root",
        children: [
          {
            type: ComponentType.V2Container,
            id: "container",
            name: "Container",
            children: [
              {
                type: ComponentType.V2Section,
                id: "section",
                name: "Section",
                children: [
                  {
                    type: ComponentType.V2TextDisplay,
                    id: "text",
                    name: "Text",
                    content: "Content",
                  },
                ],
                accessory: {
                  type: ComponentType.V2Thumbnail,
                  id: "thumb",
                  name: "Thumbnail",
                  mediaUrl: "{{image}}",
                },
              },
            ],
          },
        ],
      };

      const result = convertTemplateMessageComponentToPreviewInput(messageComponent);

      expect(result.componentsV2).toBeDefined();
      const container = result.componentsV2?.[0] as Record<string, unknown>;
      const components = container.components as Array<Record<string, unknown>>;
      expect(components[0].type).toBe("SECTION");
      expect((components[0].accessory as Record<string, unknown>).type).toBe("THUMBNAIL");
    });

    it("converts V2ActionRow with buttons", () => {
      const messageComponent: V2MessageComponentRoot = {
        type: ComponentType.V2Root,
        id: "root",
        name: "Root",
        children: [
          {
            type: ComponentType.V2Container,
            id: "container",
            name: "Container",
            children: [
              {
                type: ComponentType.V2ActionRow,
                id: "action-row",
                name: "Actions",
                children: [
                  {
                    type: ComponentType.V2Button,
                    id: "btn",
                    name: "Button",
                    label: "Read More",
                    style: DiscordButtonStyle.Link,
                    href: "{{link}}",
                    disabled: false,
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = convertTemplateMessageComponentToPreviewInput(messageComponent);

      expect(result.componentsV2).toBeDefined();
      const container = result.componentsV2?.[0] as Record<string, unknown>;
      const components = container.components as Array<Record<string, unknown>>;
      expect(components[0].type).toBe("ACTION_ROW");
      const actionRowComponents = components[0].components as Array<Record<string, unknown>>;
      expect(actionRowComponents[0].type).toBe("BUTTON");
      expect(actionRowComponents[0].label).toBe("Read More");
      expect(actionRowComponents[0].url).toBe("{{link}}");
    });

    it("converts V2Divider to separator", () => {
      const messageComponent: V2MessageComponentRoot = {
        type: ComponentType.V2Root,
        id: "root",
        name: "Root",
        children: [
          {
            type: ComponentType.V2Container,
            id: "container",
            name: "Container",
            children: [
              {
                type: ComponentType.V2Divider,
                id: "divider",
                name: "Divider",
                visual: true,
                spacing: 2,
                children: [],
              },
            ],
          },
        ],
      };

      const result = convertTemplateMessageComponentToPreviewInput(messageComponent);

      expect(result.componentsV2).toBeDefined();
      const container = result.componentsV2?.[0] as Record<string, unknown>;
      const components = container.components as Array<Record<string, unknown>>;
      expect(components[0].type).toBe("SEPARATOR");
      expect(components[0].divider).toBe(true);
      expect(components[0].spacing).toBe(2);
    });

    it("converts V2MediaGallery", () => {
      const messageComponent: V2MessageComponentRoot = {
        type: ComponentType.V2Root,
        id: "root",
        name: "Root",
        children: [
          {
            type: ComponentType.V2Container,
            id: "container",
            name: "Container",
            children: [
              {
                type: ComponentType.V2MediaGallery,
                id: "gallery",
                name: "Gallery",
                children: [
                  {
                    type: ComponentType.V2MediaGalleryItem,
                    id: "item",
                    name: "Item",
                    mediaUrl: "{{image}}",
                    description: "Image description",
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = convertTemplateMessageComponentToPreviewInput(messageComponent);

      expect(result.componentsV2).toBeDefined();
      const container = result.componentsV2?.[0] as Record<string, unknown>;
      const components = container.components as Array<Record<string, unknown>>;
      expect(components[0].type).toBe("MEDIA_GALLERY");
    });

    it("sets content and embeds to null/undefined for V2 templates", () => {
      const messageComponent: V2MessageComponentRoot = {
        type: ComponentType.V2Root,
        id: "root",
        name: "Root",
        children: [],
      };

      const result = convertTemplateMessageComponentToPreviewInput(messageComponent);

      expect(result.content).toBeNull();
      expect(result.embeds).toBeUndefined();
    });
  });
});
