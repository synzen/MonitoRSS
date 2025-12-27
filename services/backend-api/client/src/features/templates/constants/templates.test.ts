import { ComponentType } from "../../../pages/MessageBuilder/types";
import {
  DEFAULT_TEMPLATE_ID,
  DEFAULT_TEMPLATE,
  RICH_EMBED_TEMPLATE,
  COMPACT_CARD_TEMPLATE,
  MEDIA_GALLERY_TEMPLATE,
  TEMPLATES,
  getTemplateById,
  getDefaultTemplate,
  isDefaultTemplate,
} from "./templates";

describe("templates", () => {
  describe("TEMPLATES array", () => {
    it("contains exactly 4 templates", () => {
      expect(TEMPLATES).toHaveLength(4);
    });

    it("has default template first", () => {
      expect(TEMPLATES[0]).toBe(DEFAULT_TEMPLATE);
    });

    it("contains all individual templates", () => {
      expect(TEMPLATES).toContain(DEFAULT_TEMPLATE);
      expect(TEMPLATES).toContain(RICH_EMBED_TEMPLATE);
      expect(TEMPLATES).toContain(COMPACT_CARD_TEMPLATE);
      expect(TEMPLATES).toContain(MEDIA_GALLERY_TEMPLATE);
    });

    it("all templates have unique ids", () => {
      const ids = TEMPLATES.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe("DEFAULT_TEMPLATE", () => {
    it("has id matching DEFAULT_TEMPLATE_ID", () => {
      expect(DEFAULT_TEMPLATE.id).toBe(DEFAULT_TEMPLATE_ID);
    });

    it("has empty requiredFields array", () => {
      expect(DEFAULT_TEMPLATE.requiredFields).toEqual([]);
    });

    it("uses LegacyRoot format", () => {
      expect(DEFAULT_TEMPLATE.createMessageComponent().type).toBe(ComponentType.LegacyRoot);
    });
  });

  describe("RICH_EMBED_TEMPLATE", () => {
    it("requires description field", () => {
      expect(RICH_EMBED_TEMPLATE.requiredFields).toContain("description");
    });

    it("uses LegacyRoot format", () => {
      expect(RICH_EMBED_TEMPLATE.createMessageComponent().type).toBe(ComponentType.LegacyRoot);
    });
  });

  describe("COMPACT_CARD_TEMPLATE", () => {
    it("requires title field", () => {
      expect(COMPACT_CARD_TEMPLATE.requiredFields).toEqual(["title"]);
    });

    it("uses V2Root format", () => {
      expect(COMPACT_CARD_TEMPLATE.createMessageComponent().type).toBe(ComponentType.V2Root);
    });
  });

  describe("MEDIA_GALLERY_TEMPLATE", () => {
    it("requires image field", () => {
      expect(MEDIA_GALLERY_TEMPLATE.requiredFields).toContain("image");
    });

    it("uses V2Root format", () => {
      expect(MEDIA_GALLERY_TEMPLATE.createMessageComponent().type).toBe(ComponentType.V2Root);
    });
  });

  describe("getTemplateById", () => {
    it("returns template when id exists", () => {
      expect(getTemplateById("default")).toBe(DEFAULT_TEMPLATE);
      expect(getTemplateById("rich-embed")).toBe(RICH_EMBED_TEMPLATE);
      expect(getTemplateById("compact-card")).toBe(COMPACT_CARD_TEMPLATE);
      expect(getTemplateById("media-gallery")).toBe(MEDIA_GALLERY_TEMPLATE);
    });

    it("returns undefined for non-existent id", () => {
      expect(getTemplateById("non-existent")).toBeUndefined();
    });

    it("returns undefined for empty string", () => {
      expect(getTemplateById("")).toBeUndefined();
    });
  });

  describe("getDefaultTemplate", () => {
    it("returns DEFAULT_TEMPLATE", () => {
      expect(getDefaultTemplate()).toBe(DEFAULT_TEMPLATE);
    });

    it("returns template with id 'default'", () => {
      expect(getDefaultTemplate().id).toBe("default");
    });
  });

  describe("isDefaultTemplate", () => {
    it("returns true for DEFAULT_TEMPLATE", () => {
      expect(isDefaultTemplate(DEFAULT_TEMPLATE)).toBe(true);
    });

    it("returns false for other templates", () => {
      expect(isDefaultTemplate(RICH_EMBED_TEMPLATE)).toBe(false);
      expect(isDefaultTemplate(COMPACT_CARD_TEMPLATE)).toBe(false);
      expect(isDefaultTemplate(MEDIA_GALLERY_TEMPLATE)).toBe(false);
    });

    it("returns true for any template with id 'default'", () => {
      const customDefault = { ...RICH_EMBED_TEMPLATE, id: "default" };
      expect(isDefaultTemplate(customDefault)).toBe(true);
    });
  });
});
