import { describe, it, expect } from "vitest";
import extractResolutionWarnings from "./extractResolutionWarnings";
import { ComponentType, V2MessageComponentRoot, LegacyMessageComponentRoot } from "../types";
import { DiscordButtonStyle } from "../constants/DiscordButtonStyle";

// eslint-disable-next-line no-bitwise
const V2_FLAG = 1 << 15;

describe("extractResolutionWarnings", () => {
  it("returns [] when template is undefined", () => {
    expect(extractResolutionWarnings(undefined, [{ components: [] }])).toEqual([]);
  });

  it("returns [] when resolvedMessages is undefined", () => {
    const template: V2MessageComponentRoot = {
      id: "root",
      name: "root",
      type: ComponentType.V2Root,
      children: [],
    };
    expect(extractResolutionWarnings(template, undefined)).toEqual([]);
  });

  it("returns [] when resolvedMessages is empty", () => {
    const template: V2MessageComponentRoot = {
      id: "root",
      name: "root",
      type: ComponentType.V2Root,
      children: [],
    };
    expect(extractResolutionWarnings(template, [])).toEqual([]);
  });

  describe("V2 TextDisplay", () => {
    it("warns when placeholder in content resolves to empty", () => {
      const template: V2MessageComponentRoot = {
        id: "root",
        name: "root",
        type: ComponentType.V2Root,
        children: [
          {
            id: "td-1",
            name: "Text",
            type: ComponentType.V2TextDisplay,
            content: "{{description}}",
            children: [],
          },
        ],
      };
      const resolved = [{ flags: V2_FLAG, components: [{ type: 10, content: "" }] }];

      const warnings = extractResolutionWarnings(template, resolved);

      expect(warnings).toHaveLength(1);
      expect(warnings[0].severity).toBe("warning");
      expect(warnings[0].componentId).toBe("td-1");
      expect(warnings[0].message).toContain("placeholder");
    });

    it("does not warn when placeholder resolves to non-empty", () => {
      const template: V2MessageComponentRoot = {
        id: "root",
        name: "root",
        type: ComponentType.V2Root,
        children: [
          {
            id: "td-1",
            name: "Text",
            type: ComponentType.V2TextDisplay,
            content: "{{title}}",
            children: [],
          },
        ],
      };
      const resolved = [{ flags: V2_FLAG, components: [{ type: 10, content: "Some Title" }] }];

      expect(extractResolutionWarnings(template, resolved)).toHaveLength(0);
    });

    it("does not warn when static text resolves to empty", () => {
      const template: V2MessageComponentRoot = {
        id: "root",
        name: "root",
        type: ComponentType.V2Root,
        children: [
          {
            id: "td-1",
            name: "Text",
            type: ComponentType.V2TextDisplay,
            content: "Hello",
            children: [],
          },
        ],
      };
      const resolved = [{ flags: V2_FLAG, components: [{ type: 10, content: "" }] }];

      expect(extractResolutionWarnings(template, resolved)).toHaveLength(0);
    });
  });

  describe("V2 Button", () => {
    it("warns when placeholder in label resolves to empty", () => {
      const template: V2MessageComponentRoot = {
        id: "root",
        name: "root",
        type: ComponentType.V2Root,
        children: [
          {
            id: "ar-1",
            name: "Action Row",
            type: ComponentType.V2ActionRow,
            children: [
              {
                id: "btn-1",
                name: "Button",
                type: ComponentType.V2Button,
                label: "{{title}}",
                style: DiscordButtonStyle.Link,
                disabled: false,
                href: "https://example.com",
              },
            ],
          },
        ],
      };
      const resolved = [
        {
          flags: V2_FLAG,
          components: [{ type: 1, components: [{ type: 2, label: "", style: 5 }] }],
        },
      ];

      const warnings = extractResolutionWarnings(template, resolved);

      expect(warnings).toHaveLength(1);
      expect(warnings[0].componentId).toBe("btn-1");
      expect(warnings[0].severity).toBe("warning");
    });
  });

  describe("V2 Thumbnail", () => {
    it("warns when placeholder in mediaUrl resolves to empty", () => {
      const template: V2MessageComponentRoot = {
        id: "root",
        name: "root",
        type: ComponentType.V2Root,
        children: [
          {
            id: "sec-1",
            name: "Section",
            type: ComponentType.V2Section,
            children: [
              {
                id: "td-1",
                name: "Text",
                type: ComponentType.V2TextDisplay,
                content: "Hello",
                children: [],
              },
            ],
            accessory: {
              id: "thumb-1",
              name: "Thumbnail",
              type: ComponentType.V2Thumbnail,
              mediaUrl: "{{image}}",
              children: [],
            },
          },
        ],
      };
      const resolved = [
        {
          flags: V2_FLAG,
          components: [
            {
              type: 9,
              components: [{ type: 10, content: "Hello" }],
              accessory: { type: 11, media: { url: "" } },
            },
          ],
        },
      ];

      const warnings = extractResolutionWarnings(template, resolved);

      expect(warnings).toHaveLength(1);
      expect(warnings[0].componentId).toBe("thumb-1");
    });
  });

  describe("V2 MediaGalleryItem", () => {
    it("warns when placeholder in mediaUrl resolves to empty", () => {
      const template: V2MessageComponentRoot = {
        id: "root",
        name: "root",
        type: ComponentType.V2Root,
        children: [
          {
            id: "mg-1",
            name: "Media Gallery",
            type: ComponentType.V2MediaGallery,
            children: [
              {
                id: "mgi-1",
                name: "Item",
                type: ComponentType.V2MediaGalleryItem,
                mediaUrl: "{{image}}",
                children: [],
              },
            ],
          },
        ],
      };
      const resolved = [
        {
          flags: V2_FLAG,
          components: [{ type: 12, items: [{ media: { url: "" } }] }],
        },
      ];

      const warnings = extractResolutionWarnings(template, resolved);

      expect(warnings).toHaveLength(1);
      expect(warnings[0].componentId).toBe("mgi-1");
    });
  });

  describe("V2 Container nesting", () => {
    it("produces warnings for components inside a Container", () => {
      const template: V2MessageComponentRoot = {
        id: "root",
        name: "root",
        type: ComponentType.V2Root,
        children: [
          {
            id: "container-1",
            name: "Container",
            type: ComponentType.V2Container,
            children: [
              {
                id: "td-1",
                name: "Text",
                type: ComponentType.V2TextDisplay,
                content: "{{description}}",
                children: [],
              },
            ],
          },
        ],
      };
      const resolved = [
        {
          flags: V2_FLAG,
          components: [
            {
              type: 17,
              components: [{ type: 10, content: "" }],
            },
          ],
        },
      ];

      const warnings = extractResolutionWarnings(template, resolved);

      expect(warnings).toHaveLength(1);
      expect(warnings[0].componentId).toBe("td-1");
    });
  });

  describe("Multiple components with issues", () => {
    it("returns multiple warnings", () => {
      const template: V2MessageComponentRoot = {
        id: "root",
        name: "root",
        type: ComponentType.V2Root,
        children: [
          {
            id: "td-1",
            name: "Text 1",
            type: ComponentType.V2TextDisplay,
            content: "{{description}}",
            children: [],
          },
          {
            id: "td-2",
            name: "Text 2",
            type: ComponentType.V2TextDisplay,
            content: "{{author}}",
            children: [],
          },
        ],
      };
      const resolved = [
        {
          flags: V2_FLAG,
          components: [
            { type: 10, content: "" },
            { type: 10, content: "" },
          ],
        },
      ];

      const warnings = extractResolutionWarnings(template, resolved);

      expect(warnings).toHaveLength(2);
      expect(warnings[0].componentId).toBe("td-1");
      expect(warnings[1].componentId).toBe("td-2");
    });
  });

  describe("Legacy embeds", () => {
    const makeLegacyTemplate = (embedChildren: any[]): LegacyMessageComponentRoot => ({
      id: "root",
      name: "root",
      type: ComponentType.LegacyRoot,
      children: [
        {
          id: "embed-container",
          name: "Embeds",
          type: ComponentType.LegacyEmbedContainer,
          children: [
            {
              id: "embed-1",
              name: "Embed",
              type: ComponentType.LegacyEmbed,
              children: embedChildren,
            },
          ],
        },
      ],
    });

    it("warns when embed title placeholder resolves to empty", () => {
      const template = makeLegacyTemplate([
        {
          id: "title-1",
          name: "Title",
          type: ComponentType.LegacyEmbedTitle,
          title: "{{title}}",
          children: [],
        },
      ]);
      const resolved = [{ embeds: [{ title: "" }] }];

      const warnings = extractResolutionWarnings(template, resolved);

      expect(warnings).toHaveLength(1);
      expect(warnings[0].componentId).toBe("title-1");
      expect(warnings[0].severity).toBe("warning");
    });

    it("warns when embed description placeholder resolves to empty", () => {
      const template = makeLegacyTemplate([
        {
          id: "desc-1",
          name: "Description",
          type: ComponentType.LegacyEmbedDescription,
          description: "{{description}}",
          children: [],
        },
      ]);
      const resolved = [{ embeds: [{ description: "" }] }];

      const warnings = extractResolutionWarnings(template, resolved);

      expect(warnings).toHaveLength(1);
      expect(warnings[0].componentId).toBe("desc-1");
    });

    it("warns when embed thumbnail placeholder resolves to empty", () => {
      const template = makeLegacyTemplate([
        {
          id: "thumb-1",
          name: "Thumbnail",
          type: ComponentType.LegacyEmbedThumbnail,
          thumbnailUrl: "{{image}}",
          children: [],
        },
      ]);
      const resolved = [{ embeds: [{ thumbnail: { url: "" } }] }];

      const warnings = extractResolutionWarnings(template, resolved);

      expect(warnings).toHaveLength(1);
      expect(warnings[0].componentId).toBe("thumb-1");
    });

    it("warns when embed image placeholder resolves to empty", () => {
      const template = makeLegacyTemplate([
        {
          id: "img-1",
          name: "Image",
          type: ComponentType.LegacyEmbedImage,
          imageUrl: "{{image}}",
          children: [],
        },
      ]);
      const resolved = [{ embeds: [{ image: { url: "" } }] }];

      const warnings = extractResolutionWarnings(template, resolved);

      expect(warnings).toHaveLength(1);
      expect(warnings[0].componentId).toBe("img-1");
    });

    it("warns when embed author name placeholder resolves to empty", () => {
      const template = makeLegacyTemplate([
        {
          id: "author-1",
          name: "Author",
          type: ComponentType.LegacyEmbedAuthor,
          authorName: "{{author}}",
          children: [],
        },
      ]);
      const resolved = [{ embeds: [{ author: { name: "" } }] }];

      const warnings = extractResolutionWarnings(template, resolved);

      expect(warnings).toHaveLength(1);
      expect(warnings[0].componentId).toBe("author-1");
    });

    it("warns when embed footer text placeholder resolves to empty", () => {
      const template = makeLegacyTemplate([
        {
          id: "footer-1",
          name: "Footer",
          type: ComponentType.LegacyEmbedFooter,
          footerText: "{{footer}}",
          children: [],
        },
      ]);
      const resolved = [{ embeds: [{ footer: { text: "" } }] }];

      const warnings = extractResolutionWarnings(template, resolved);

      expect(warnings).toHaveLength(1);
      expect(warnings[0].componentId).toBe("footer-1");
    });
  });

  describe("Legacy buttons", () => {
    it("warns when button label placeholder resolves to empty", () => {
      const template: LegacyMessageComponentRoot = {
        id: "root",
        name: "root",
        type: ComponentType.LegacyRoot,
        children: [
          {
            id: "ar-1",
            name: "Action Row",
            type: ComponentType.LegacyActionRow,
            children: [
              {
                id: "btn-1",
                name: "Button",
                type: ComponentType.LegacyButton,
                label: "{{title}}",
                style: DiscordButtonStyle.Link,
                disabled: false,
                url: "https://example.com",
              },
            ],
          },
        ],
      };
      const resolved = [
        {
          components: [{ type: 1, components: [{ type: 2, label: "", style: 5 }] }],
        },
      ];

      const warnings = extractResolutionWarnings(template, resolved);

      expect(warnings).toHaveLength(1);
      expect(warnings[0].componentId).toBe("btn-1");
      expect(warnings[0].severity).toBe("warning");
    });
  });

  describe("stripped components", () => {
    it("does not false-warn when a component is stripped from resolved output", () => {
      const template: V2MessageComponentRoot = {
        id: "root",
        name: "root",
        type: ComponentType.V2Root,
        children: [
          {
            id: "container-1",
            name: "Container",
            type: ComponentType.V2Container,
            children: [
              {
                id: "sep-1",
                name: "Divider",
                type: ComponentType.V2Divider,
                children: [],
              },
              {
                id: "mg-1",
                name: "Media Gallery",
                type: ComponentType.V2MediaGallery,
                children: [
                  {
                    id: "mgi-1",
                    name: "Item",
                    type: ComponentType.V2MediaGalleryItem,
                    mediaUrl: "{{image}}",
                    children: [],
                  },
                ],
              },
              {
                id: "td-1",
                name: "Text",
                type: ComponentType.V2TextDisplay,
                content: "### [{{title}}]({{link}})\n**{{author}}**",
                children: [],
              },
              {
                id: "sep-2",
                name: "Divider",
                type: ComponentType.V2Divider,
                children: [],
              },
            ],
          },
        ],
      };
      // MediaGallery stripped (e.g. stripImages), so resolved only has 3 children
      const resolved = [
        {
          flags: V2_FLAG,
          components: [
            {
              type: 17,
              components: [
                { type: 14, divider: true, spacing: 1 },
                {
                  type: 10,
                  content: "### [Some Title](https://example.com)\n**Some Author**",
                },
                { type: 14, divider: false, spacing: 1 },
              ],
            },
          ],
        },
      ];

      const warnings = extractResolutionWarnings(template, resolved);

      expect(warnings).toHaveLength(0);
    });
  });

  it("all warnings have severity 'warning'", () => {
    const template: V2MessageComponentRoot = {
      id: "root",
      name: "root",
      type: ComponentType.V2Root,
      children: [
        {
          id: "td-1",
          name: "Text",
          type: ComponentType.V2TextDisplay,
          content: "{{a}}",
          children: [],
        },
        {
          id: "td-2",
          name: "Text 2",
          type: ComponentType.V2TextDisplay,
          content: "{{b}}",
          children: [],
        },
      ],
    };
    const resolved = [
      {
        flags: V2_FLAG,
        components: [
          { type: 10, content: "" },
          { type: 10, content: "" },
        ],
      },
    ];

    const warnings = extractResolutionWarnings(template, resolved);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.every((w) => w.severity === "warning")).toBe(true);
  });
});
