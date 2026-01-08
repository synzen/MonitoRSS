import { describe, it } from "node:test";
import assert, { deepStrictEqual } from "node:assert";
import {
  replaceTemplateString,
  applySplit,
  generateDiscordPayloads,
  formatValueForDiscord,
  formatArticleForDiscord,
  getNestedPrimitiveValue,
  processCustomPlaceholders,
  CustomPlaceholderStepType,
  DiscordComponentType,
  DISCORD_COMPONENTS_V2_FLAG,
  generateThreadName,
  buildForumThreadBody,
  getForumTagsToSend,
  enhancePayloadsWithWebhookDetails,
} from ".";
import {
  ExpressionType,
  LogicalExpressionOperator,
  RelationalExpressionOperator,
  RelationalExpressionLeft,
  RelationalExpressionRight,
} from "../filters";
import type { Article, FlattenedArticle } from "../parser";

function createArticle(flattened: Record<string, string>): Article {
  return {
    flattened: {
      id: "test-id",
      idHash: "test-hash",
      ...flattened,
    },
    raw: {},
  };
}

describe("article-formatter", () => {
  describe("replaceTemplateString", () => {
    it("replaces simple placeholders", () => {
      const result = replaceTemplateString(
        { title: "Hello World" },
        "Title: {{title}}"
      );
      assert.strictEqual(result, "Title: Hello World");
    });

    it("replaces multiple placeholders", () => {
      const result = replaceTemplateString(
        { title: "Hello", author: "John" },
        "{{title}} by {{author}}"
      );
      assert.strictEqual(result, "Hello by John");
    });

    it("replaces with empty string for missing placeholders", () => {
      const result = replaceTemplateString(
        { title: "Hello" },
        "{{title}} - {{missing}}"
      );
      assert.strictEqual(result, "Hello - ");
    });

    it("supports fallback syntax", () => {
      const result = replaceTemplateString(
        { title: "Hello" },
        "{{missing||title}}",
        { supportFallbacks: true }
      );
      assert.strictEqual(result, "Hello");
    });

    it("supports text:: fallback", () => {
      const result = replaceTemplateString(
        {},
        "{{missing||text::Default Text}}",
        { supportFallbacks: true }
      );
      assert.strictEqual(result, "Default Text");
    });

    it("uses first non-empty value in fallback chain", () => {
      const result = replaceTemplateString(
        { third: "Third Value" },
        "{{first||second||third}}",
        { supportFallbacks: true }
      );
      assert.strictEqual(result, "Third Value");
    });

    it("applies placeholder limits with fallback syntax - first placeholder used", () => {
      const result = replaceTemplateString(
        { summary: "This is a long summary that should be truncated", description: "Description text" },
        "{{summary||description}}",
        {
          supportFallbacks: true,
          split: {
            func: (str, opts) => str.substring(0, opts.limit) + (str.length > opts.limit ? (opts.appendString || "") : ""),
            limits: [
              { placeholder: "summary", characterCount: 15, appendString: "..." },
              { placeholder: "description", characterCount: 20, appendString: "..." },
            ],
          },
        }
      );
      // Should use summary limit (15) since summary was used
      assert.ok(result!.startsWith("This is a long "));
      assert.ok(result!.endsWith("..."));
      assert.ok(result!.length <= 18); // 15 + 3 for "..."
    });

    it("applies placeholder limits with fallback syntax - falls back to second placeholder", () => {
      const result = replaceTemplateString(
        { description: "This is a long description that should be truncated" },
        "{{summary||description}}",
        {
          supportFallbacks: true,
          split: {
            func: (str, opts) => str.substring(0, opts.limit) + (str.length > opts.limit ? (opts.appendString || "") : ""),
            limits: [
              { placeholder: "summary", characterCount: 10, appendString: " [sum]" },
              { placeholder: "description", characterCount: 15, appendString: " [desc]" },
            ],
          },
        }
      );
      // Should use description limit (15) since description was used as fallback
      assert.ok(result!.startsWith("This is a long "));
      assert.ok(result!.endsWith("[desc]"));
      assert.ok(result!.length <= 22); // 15 + 7 for " [desc]"
    });

    it("does not apply placeholder limits when fallback resolves to literal text", () => {
      const result = replaceTemplateString(
        {},
        "{{summary||text::No summary available}}",
        {
          supportFallbacks: true,
          split: {
            func: (str, opts) => str.substring(0, opts.limit) + (str.length > opts.limit ? (opts.appendString || "") : ""),
            limits: [
              { placeholder: "summary", characterCount: 5, appendString: "..." },
            ],
          },
        }
      );
      // Literal text should not be truncated
      assert.strictEqual(result, "No summary available");
    });

    it("supports limit on full accessor string as fallback", () => {
      const result = replaceTemplateString(
        { summary: "This is a long summary text" },
        "{{summary||description}}",
        {
          supportFallbacks: true,
          split: {
            func: (str, opts) => str.substring(0, opts.limit) + (str.length > opts.limit ? (opts.appendString || "") : ""),
            limits: [
              { placeholder: "summary||description", characterCount: 10, appendString: "..." },
            ],
          },
        }
      );
      // Should use the full accessor limit
      assert.ok(result!.length <= 13); // 10 + 3 for "..."
    });
  });

  describe("applySplit", () => {
    it("returns single item for short text", () => {
      const result = applySplit("Hello World", { limit: 100 });
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0], "Hello World");
    });

    it("truncates long text by default", () => {
      const longText = "A".repeat(100);
      const result = applySplit(longText, { limit: 50 });
      assert.strictEqual(result.length, 1);
      assert.ok(result[0]!.length <= 50);
    });

    it("splits into multiple parts when enabled", () => {
      const longText = "A".repeat(100);
      const result = applySplit(longText, { limit: 50, isEnabled: true });
      assert.ok(result.length > 1);
    });

    it("handles undefined input", () => {
      const result = applySplit(undefined);
      assert.deepStrictEqual(result, [""]);
    });
  });

  describe("generateDiscordPayloads", () => {
    it("generates payload with content", () => {
      const article = createArticle({ title: "Test Title" });
      const payloads = generateDiscordPayloads(article, {
        content: "New article: {{title}}",
      });

      assert.strictEqual(payloads.length, 1);
      assert.strictEqual(payloads[0]!.content, "New article: Test Title");
    });

    it("generates payload with embeds", () => {
      const article = createArticle({
        title: "Test Title",
        description: "Test Desc",
      });
      const payloads = generateDiscordPayloads(article, {
        embeds: [
          {
            title: "{{title}}",
            description: "{{description}}",
            color: 0x00ff00,
          },
        ],
      });

      assert.strictEqual(payloads.length, 1);
      assert.strictEqual(payloads[0]!.embeds?.length, 1);
      assert.strictEqual(payloads[0]!.embeds?.[0]?.title, "Test Title");
      assert.strictEqual(payloads[0]!.embeds?.[0]?.description, "Test Desc");
      assert.strictEqual(payloads[0]!.embeds?.[0]?.color, 0x00ff00);
    });

    it("filters out empty payloads", () => {
      const article = createArticle({});
      const payloads = generateDiscordPayloads(article, {
        content: "{{missing}}",
        embeds: [],
      });

      assert.strictEqual(payloads.length, 0);
    });

    it("truncates embed fields to Discord limits", () => {
      const article = createArticle({ title: "A".repeat(500) });
      const payloads = generateDiscordPayloads(article, {
        embeds: [{ title: "{{title}}" }],
      });

      assert.ok((payloads[0]!.embeds?.[0]?.title?.length ?? 0) <= 256);
    });

    it("supports placeholder fallbacks", () => {
      const article = createArticle({ backup: "Backup Title" });
      const payloads = generateDiscordPayloads(article, {
        content: "{{title||backup}}",
        enablePlaceholderFallback: true,
      });

      assert.strictEqual(payloads[0]!.content, "Backup Title");
    });

    it("adds timestamp when configured", () => {
      const article = createArticle({});
      article.raw.date = "2024-01-01T12:00:00Z";

      const payloads = generateDiscordPayloads(article, {
        embeds: [{ title: "Test", timestamp: "article" }],
      });

      assert.notStrictEqual(payloads[0]!.embeds?.[0]?.timestamp, undefined);
    });

    describe("V2 Components", () => {
      it("returns V2 flag when componentsV2 is provided", () => {
        const article = createArticle({ title: "Test" });
        const payloads = generateDiscordPayloads(article, {
          componentsV2: [
            {
              type: "SECTION",
              components: [{ type: "TEXT_DISPLAY", content: "{{title}}" }],
              accessory: {
                type: "BUTTON",
                style: 5,
                label: "Click",
                url: "https://example.com",
              },
            },
          ],
        });

        assert.strictEqual(payloads.length, 1);
        assert.strictEqual(payloads[0]!.flags, DISCORD_COMPONENTS_V2_FLAG);
        assert.notStrictEqual(payloads[0]!.components, undefined);
        assert.strictEqual(payloads[0]!.content, undefined);
      });

      describe("Media Gallery", () => {
        it("filters out media gallery items with empty URLs", () => {
          const article = createArticle({
            image1: "https://example.com/1.png",
          });
          const payloads = generateDiscordPayloads(article, {
            componentsV2: [
              {
                type: "CONTAINER",
                components: [
                  {
                    type: "MEDIA_GALLERY",
                    items: [
                      { media: { url: "{{image1}}" } },
                      { media: { url: "{{missing_image}}" } },
                    ],
                  },
                ],
              },
            ],
          });

          assert.strictEqual(payloads.length, 1);
          const container = payloads[0]!.components![0] as {
            components: Array<{ items: Array<{ media: { url: string } }> }>;
          };
          const gallery = container.components[0]!;
          assert.strictEqual(gallery.items.length, 1);
          assert.strictEqual(
            gallery.items[0]!.media.url,
            "https://example.com/1.png"
          );
        });

        it("removes entire media gallery when all items have empty URLs", () => {
          const article = createArticle({ title: "Test" });
          const payloads = generateDiscordPayloads(article, {
            componentsV2: [
              {
                type: "CONTAINER",
                components: [
                  {
                    type: "TEXT_DISPLAY",
                    content: "{{title}}",
                  },
                  {
                    type: "MEDIA_GALLERY",
                    items: [
                      { media: { url: "{{missing1}}" } },
                      { media: { url: "{{missing2}}" } },
                    ],
                  },
                ],
              },
            ],
          });

          assert.strictEqual(payloads.length, 1);
          const container = payloads[0]!.components![0] as {
            components: Array<{ type: number }>;
          };
          // Only the TEXT_DISPLAY should remain, gallery should be filtered out
          assert.strictEqual(container.components.length, 1);
        });

        it("preserves media gallery items with valid static URLs", () => {
          const article = createArticle({});
          const payloads = generateDiscordPayloads(article, {
            componentsV2: [
              {
                type: "CONTAINER",
                components: [
                  {
                    type: "MEDIA_GALLERY",
                    items: [
                      { media: { url: "https://example.com/static.png" } },
                      {
                        media: { url: "https://example.com/another.png" },
                        description: "A description",
                      },
                    ],
                  },
                ],
              },
            ],
          });

          assert.strictEqual(payloads.length, 1);
          const container = payloads[0]!.components![0] as {
            components: Array<{
              items: Array<{ media: { url: string }; description?: string }>;
            }>;
          };
          const gallery = container.components[0]!;
          assert.strictEqual(gallery.items.length, 2);
          assert.strictEqual(
            gallery.items[0]!.media.url,
            "https://example.com/static.png"
          );
          assert.strictEqual(
            gallery.items[1]!.media.url,
            "https://example.com/another.png"
          );
          assert.strictEqual(gallery.items[1]!.description, "A description");
        });

        it("replaces placeholders in media gallery item URLs", () => {
          const article = createArticle({
            img: "https://example.com/dynamic.png",
            desc: "Dynamic description",
          });
          const payloads = generateDiscordPayloads(article, {
            componentsV2: [
              {
                type: "CONTAINER",
                components: [
                  {
                    type: "MEDIA_GALLERY",
                    items: [
                      { media: { url: "{{img}}" }, description: "{{desc}}" },
                    ],
                  },
                ],
              },
            ],
          });

          assert.strictEqual(payloads.length, 1);
          const container = payloads[0]!.components![0] as {
            components: Array<{
              items: Array<{ media: { url: string }; description?: string }>;
            }>;
          };
          const gallery = container.components[0]!;
          assert.strictEqual(gallery.items.length, 1);
          assert.strictEqual(
            gallery.items[0]!.media.url,
            "https://example.com/dynamic.png"
          );
          assert.strictEqual(
            gallery.items[0]!.description,
            "Dynamic description"
          );
        });

        it("encodes spaces in media gallery URLs", () => {
          const article = createArticle({
            img: "https://example.com/image with spaces.png",
          });
          const payloads = generateDiscordPayloads(article, {
            componentsV2: [
              {
                type: "CONTAINER",
                components: [
                  {
                    type: "MEDIA_GALLERY",
                    items: [{ media: { url: "{{img}}" } }],
                  },
                ],
              },
            ],
          });

          const container = payloads[0]!.components![0] as {
            components: Array<{ items: Array<{ media: { url: string } }> }>;
          };
          const gallery = container.components[0]!;
          assert.strictEqual(
            gallery.items[0]!.media.url,
            "https://example.com/image%20with%20spaces.png"
          );
        });

        it("preserves spoiler flag on media gallery items", () => {
          const article = createArticle({
            img: "https://example.com/spoiler.png",
          });
          const payloads = generateDiscordPayloads(article, {
            componentsV2: [
              {
                type: "CONTAINER",
                components: [
                  {
                    type: "MEDIA_GALLERY",
                    items: [{ media: { url: "{{img}}" }, spoiler: true }],
                  },
                ],
              },
            ],
          });

          const container = payloads[0]!.components![0] as {
            components: Array<{ items: Array<{ spoiler?: boolean }> }>;
          };
          const gallery = container.components[0]!;
          assert.strictEqual(gallery.items[0]!.spoiler, true);
        });
      });

      it("silently prefers V2 over V1 when both are provided", () => {
        const article = createArticle({ title: "Test" });
        const payloads = generateDiscordPayloads(article, {
          content: "Should be ignored",
          embeds: [{ title: "Should be ignored" }],
          components: [
            {
              type: DiscordComponentType.ActionRow,
              components: [
                {
                  type: DiscordComponentType.Button,
                  style: 5,
                  label: "V1 Button",
                  url: "https://v1.com",
                },
              ],
            },
          ],
          componentsV2: [
            {
              type: "SEPARATOR",
              divider: true,
              spacing: 1,
            },
          ],
        });

        assert.strictEqual(payloads.length, 1);
        assert.strictEqual(payloads[0]!.flags, DISCORD_COMPONENTS_V2_FLAG);
        // V2 takes precedence, content should not be present
        assert.strictEqual(payloads[0]!.content, undefined);
      });
    });

    describe("V1 Components", () => {
      it("adds V1 components to the last payload", () => {
        const article = createArticle({ title: "Test" });
        const payloads = generateDiscordPayloads(article, {
          content: "Hello {{title}}",
          components: [
            {
              type: DiscordComponentType.ActionRow,
              components: [
                {
                  type: DiscordComponentType.Button,
                  style: 5,
                  label: "{{title}}",
                  url: "https://example.com",
                },
              ],
            },
          ],
        });

        assert.strictEqual(payloads.length, 1);
        assert.strictEqual(payloads[0]!.content, "Hello Test");
        assert.notStrictEqual(payloads[0]!.components, undefined);
        assert.strictEqual(payloads[0]!.components!.length, 1);
        // Check the button label has placeholder replaced
        const actionRow = payloads[0]!.components![0] as {
          components: Array<{ label: string }>;
        };
        assert.strictEqual(actionRow.components[0]!.label, "Test");
      });

      it("does not set V2 flag for V1 components", () => {
        const article = createArticle({ title: "Test" });
        const payloads = generateDiscordPayloads(article, {
          content: "Hello",
          components: [
            {
              type: DiscordComponentType.ActionRow,
              components: [
                {
                  type: DiscordComponentType.Button,
                  style: 5,
                  label: "Click",
                  url: "https://example.com",
                },
              ],
            },
          ],
        });

        assert.strictEqual(payloads[0]!.flags, undefined);
      });
    });
  });

  describe("generateThreadName", () => {
    it("replaces placeholders in template", () => {
      const article = createArticle({ title: "My Article Title" });
      const name = generateThreadName(article, "New: {{title}}", {});
      assert.strictEqual(name, "New: My Article Title");
    });

    it("uses default template if not provided", () => {
      const article = createArticle({ title: "Default Title" });
      const name = generateThreadName(article, null, {});
      assert.strictEqual(name, "Default Title");
    });

    it("falls back to 'New Article' if no title", () => {
      const article = createArticle({});
      const name = generateThreadName(article, null, {});
      assert.strictEqual(name, "New Article");
    });

    it("truncates to 100 characters", () => {
      const article = createArticle({ title: "A".repeat(200) });
      const name = generateThreadName(article, "{{title}}", {});
      assert.ok(name.length <= 100);
    });
  });

  describe("buildForumThreadBody", () => {
    it("builds webhook forum body with thread_name", () => {
      const payload = { content: "Test" };
      const body = buildForumThreadBody({
        isWebhook: true,
        threadName: "My Thread",
        firstPayload: payload,
        tags: ["tag1", "tag2"],
      });

      assert.strictEqual(body.thread_name, "My Thread");
      assert.deepStrictEqual(body.applied_tags, ["tag1", "tag2"]);
      assert.strictEqual(body.content, "Test");
    });

    it("builds channel forum body with name and message", () => {
      const payload = { content: "Test" };
      const body = buildForumThreadBody({
        isWebhook: false,
        threadName: "My Thread",
        firstPayload: payload,
        tags: ["tag1"],
      });

      assert.strictEqual(body.name, "My Thread");
      assert.strictEqual(body.message, payload);
      assert.strictEqual(body.type, 11);
      assert.deepStrictEqual(body.applied_tags, ["tag1"]);
    });
  });

  describe("getForumTagsToSend", () => {
    it("returns all tag IDs when no filters", () => {
      const article = createArticle({ title: "Test" });
      const tags = getForumTagsToSend(
        [{ id: "tag1" }, { id: "tag2" }],
        article
      );
      assert.deepStrictEqual(tags, ["tag1", "tag2"]);
    });

    it("returns empty array for null tags", () => {
      const article = createArticle({});
      assert.deepStrictEqual(getForumTagsToSend(null, article), []);
      assert.deepStrictEqual(getForumTagsToSend(undefined, article), []);
    });

    it("filters tags based on expression", () => {
      const article = createArticle({ category: "tech" });
      const tags = getForumTagsToSend(
        [
          {
            id: "tech-tag",
            filters: {
              expression: {
                type: ExpressionType.Logical,
                op: LogicalExpressionOperator.And,
                children: [
                  {
                    type: ExpressionType.Relational,
                    op: RelationalExpressionOperator.Eq,
                    left: {
                      type: RelationalExpressionLeft.Article,
                      value: "category",
                    },
                    right: {
                      type: RelationalExpressionRight.String,
                      value: "tech",
                    },
                  },
                ],
              },
            },
          },
          {
            id: "sports-tag",
            filters: {
              expression: {
                type: ExpressionType.Logical,
                op: LogicalExpressionOperator.And,
                children: [
                  {
                    type: ExpressionType.Relational,
                    op: RelationalExpressionOperator.Eq,
                    left: {
                      type: RelationalExpressionLeft.Article,
                      value: "category",
                    },
                    right: {
                      type: RelationalExpressionRight.String,
                      value: "sports",
                    },
                  },
                ],
              },
            },
          },
        ],
        article
      );
      assert.deepStrictEqual(tags, ["tech-tag"]);
    });
  });

  describe("enhancePayloadsWithWebhookDetails", () => {
    it("adds username and avatar_url to payloads", () => {
      const article = createArticle({ author: "John" });
      const payloads = [{ content: "Test" }];

      const enhanced = enhancePayloadsWithWebhookDetails(
        article,
        payloads,
        "Bot: {{author}}",
        "https://avatar.com/{{author}}.png",
        {}
      );

      assert.strictEqual(enhanced[0]!.username, "Bot: John");
      assert.strictEqual(
        enhanced[0]!.avatar_url,
        "https://avatar.com/John.png"
      );
    });

    it("truncates username to 256 characters", () => {
      const article = createArticle({ author: "A".repeat(300) });
      const payloads = [{ content: "Test" }];

      const enhanced = enhancePayloadsWithWebhookDetails(
        article,
        payloads,
        "{{author}}",
        undefined,
        {}
      );

      assert.ok(enhanced[0]!.username!.length <= 256);
    });
  });
  
  describe("formatArticleForDiscord", () => {
    it("returns the original content formatted with markdown", async () => {
      const val = `<p style="text-align: left;"></p><div style="text-align: center;"><b style="font-family: arial;"><span style="font-size: large;">&nbsp;(VOSTFR)&nbsp;</span></b></div>`;

      const result = await formatArticleForDiscord(
        {
          flattened: {
            id: "1",
            idHash: "1",
            title: val,
          },
          raw: {},
        },
        {
          customPlaceholders: [
            {
              id: "test",
              referenceName: "test",
              sourcePlaceholder: "title",
              steps: [],
            },
          ],
          disableImageLinkPreviews: false,
          formatTables: false,
          stripImages: false,
        }
      );
      deepStrictEqual(result.customPlaceholderPreviews[0][0], "(VOSTFR)");
    });
  });

  describe("formatValueForDiscord", () => {
    describe("div", () => {
      it("ignores when there are no children", () => {
        const value = "<div>hello <div></div></div>";
        const result = formatValueForDiscord(value);
        assert.strictEqual(result.value, "hello");
      });
    });

    describe("br", () => {
      it("adds a newline", () => {
        const value = "hello<br />world";
        const result = formatValueForDiscord(value);
        assert.strictEqual(result.value, "hello\nworld");
      });
    });

    describe("new lines", () => {
      it("adds new lines", () => {
        const value = "hello\nworld";
        const result = formatValueForDiscord(value);
        assert.strictEqual(result.value, "hello\nworld");
      });
    });

    describe("a (anchors)", () => {
      it("returns the text with the link", () => {
        const value = 'Say <a href="https://example.com">Hello World</a> to me';
        const result = formatValueForDiscord(value);
        assert.strictEqual(
          result.value,
          "Say [Hello World](https://example.com) to me"
        );
      });

      it("does not return an anchor if the href is the same as the text", () => {
        const value =
          'Say <a href="https://example.com">https://example.com</a> to me';
        const result = formatValueForDiscord(value);
        assert.strictEqual(result.value, "Say https://example.com to me");
      });

      it("works with nested inline elements", () => {
        const value = `<a href="https://example.com"><strong>Hello World</strong></a>`;
        const result = formatValueForDiscord(value);
        assert.strictEqual(
          result.value,
          "[**Hello World**](https://example.com)"
        );
      });
    });

    describe("img", () => {
      it("returns the image link with no alt", () => {
        const value = '<img src="https://example.com/image.png" />';
        const result = formatValueForDiscord(value);
        assert.strictEqual(result.value, "https://example.com/image.png");
      });

      it("returns the image link with an alt", () => {
        const value =
          '<img src="https://example.com/image.png" alt="this should not show" />';
        const result = formatValueForDiscord(value);
        assert.strictEqual(result.value, "https://example.com/image.png");
      });

      it("excludes the image if strip image option is true", () => {
        const value = 'Hello <img src="https://example.com/image.png" /> World';
        const result = formatValueForDiscord(value, {
          stripImages: true,
          formatTables: false,
          disableImageLinkPreviews: false,
        });
        assert.strictEqual(result.value, "Hello World");
      });

      it("wraps links with < and > when disable image link previews is true", () => {
        const value =
          'Hello <img src="https://example.com/image.png" /> World <img src="https://example.com/image2.png" />';
        const result = formatValueForDiscord(value, {
          stripImages: false,
          formatTables: false,
          disableImageLinkPreviews: true,
        });
        assert.strictEqual(
          result.value,
          "Hello <https://example.com/image.png> World <https://example.com/image2.png>"
        );
      });
    });

    describe("heading", () => {
      ["h1", "h2", "h3", "h4", "h5", "h6"].forEach((elem) => {
        it(`returns the text bolded for ${elem}`, () => {
          const result = formatValueForDiscord(
            `<${elem}>hello world</${elem}>`
          );
          assert.strictEqual(result.value, "**hello world**");
        });
      });
    });

    describe("strong", () => {
      it("returns the text bolded", () => {
        const value = "a <strong>hello world</strong> b";
        const result = formatValueForDiscord(value);
        assert.strictEqual(result.value, "a **hello world** b");
      });

      it("does not add new newlines", () => {
        const value = `<p>First <strong>Before</strong>:</p>`;
        const result = formatValueForDiscord(value);
        assert.strictEqual(result.value, "First **Before**:");
      });

      it("adds spaces around it", () => {
        const value = `this <strong>is</strong> bold`;
        const result = formatValueForDiscord(value);
        assert.strictEqual(result.value, "this **is** bold");
      });
    });

    describe("code", () => {
      it("returns the text in an inline code block", () => {
        const value = "<code>hello world</code>";
        const result = formatValueForDiscord(value);
        assert.strictEqual(result.value, "`hello world`");
      });

      it("does not add new line before starting tag", () => {
        const value = `<p>First <code>Before</code>:</p>`;
        const result = formatValueForDiscord(value);
        assert.strictEqual(result.value, "First `Before`:");
      });
    });

    describe("pre", () => {
      it("returns the text in a code block", () => {
        const value = "<pre>hello world</pre>";
        const result = formatValueForDiscord(value);
        assert.strictEqual(result.value, "```hello world```");
      });

      it('returns the text in a code block if its only child is a "code" element with a text node', () => {
        const value = "<pre><code>hello world</code></pre>";
        const result = formatValueForDiscord(value);
        assert.strictEqual(result.value, "```hello world```");
      });
    });

    describe("em", () => {
      it("returns the text italicized", () => {
        const value = "<em>hello world</em>";
        const result = formatValueForDiscord(value);
        assert.strictEqual(result.value, "*hello world*");
      });
    });

    describe("u", () => {
      it("returns the text underlined", () => {
        const value = "<u>hello world</u>";
        const result = formatValueForDiscord(value);
        assert.strictEqual(result.value, "__hello world__");
      });
    });

    describe("table", () => {
      it("returns tables correctly with table formatting", () => {
        const value = `
      <table>
        <tr>
          <th>Company</th>
          <th>Contact</th>
          <th>Country</th>
        </tr>
        <tr>
          <td>Alfreds Futterkiste</td>
          <td>Maria Anders</td>
          <td>Germany</td>
        </tr>
        <tr>
          <td>Centro comercial Moctezuma</td>
          <td>Francisco Chang</td>
          <td>Mexico</td>
        </tr>
      </table>`;

        const result = formatValueForDiscord(value, {
          formatTables: true,
          stripImages: false,
          disableImageLinkPreviews: false,
        });

        assert.strictEqual(
          result.value,
          `\`\`\`

COMPANY                      CONTACT           COUNTRY
Alfreds Futterkiste          Maria Anders      Germany
Centro comercial Moctezuma   Francisco Chang   Mexico

\`\`\``
        );
      });
    });

    describe("unordered list", () => {
      it("overrides the prefix", () => {
        const result = formatValueForDiscord("<ul><li>1</li><li>2</li></ul>");
        assert.strictEqual(result.value, "* 1\n* 2");
      });
    });

    describe("paragraphs", () => {
      it("works with nested paragraphs", () => {
        const val = `
        <p>hello <strong>world 😀</strong> <p>another example</p></p>
        `;
        const result = formatValueForDiscord(val);
        assert.strictEqual(
          result.value,
          "hello **world 😀** \n\nanother example"
        );
      });

      it("does not add extra newlines for empty paragraphs", () => {
        const val = `
        <p>hello world <p></p>Hello world</p>
        `;
        const result = formatValueForDiscord(val);
        assert.strictEqual(result.value, "hello world \n\nHello world");
      });
    });
  });

  describe("applySplit edge cases", () => {
    it("does not apply split if split is not enabled", () => {
      const result = applySplit("hello world", {
        isEnabled: false,
      });
      assert.deepStrictEqual(result, ["hello world"]);
    });

    it("applies split with a low limit", () => {
      const result = applySplit("hello world", {
        limit: 4,
        isEnabled: true,
        appendChar: "",
        prependChar: "",
      });
      assert.deepStrictEqual(result, ["hell", "o", "worl", "d"]);
    });

    it("returns an empty string if input text is empty", () => {
      const result = applySplit("");
      assert.deepStrictEqual(result, [""]);
    });

    it("applies split with a high limit", () => {
      const result = applySplit("hello world", {
        limit: 100,
        isEnabled: true,
        appendChar: "",
        prependChar: "",
      });
      assert.deepStrictEqual(result, ["hello world"]);
    });

    it("does not add append char if there was nothing to split on", () => {
      const result = applySplit("hello world", {
        limit: 100,
        isEnabled: true,
        appendChar: "!",
        prependChar: "",
      });
      assert.deepStrictEqual(result, ["hello world"]);
    });

    it("does not add prepend char if there was nothing to split on", () => {
      const result = applySplit("hello world", {
        limit: 100,
        isEnabled: true,
        appendChar: "",
        prependChar: "!",
      });
      assert.deepStrictEqual(result, ["hello world"]);
    });

    it("does not add append and prepend char if there was nothing to split on", () => {
      const result = applySplit("hello world", {
        limit: 100,
        isEnabled: true,
        appendChar: "!",
        prependChar: "!",
      });
      assert.deepStrictEqual(result, ["hello world"]);
    });

    it("applies split with a high limit and append and prepend char and multiple lines", () => {
      const result = applySplit("hello world\nhello world", {
        limit: 16,
        isEnabled: true,
        appendChar: "!",
        prependChar: "!",
      });
      assert.deepStrictEqual(result, ["!hello world", "hello world!"]);
    });

    it("does not create duplicate split chars with multiple new lines", () => {
      const result = applySplit("hello world.\n\n\nhello world.\n\n\n", {
        limit: 5,
        isEnabled: true,
      });
      assert.deepStrictEqual(result, [
        "hello",
        "world",
        ".",
        "hello",
        "world",
        ".",
      ]);
    });

    it("should preserve double new lines when possible", () => {
      const result = applySplit(`a\n\na\n\nb`.trim(), {
        limit: 4,
        isEnabled: true,
      });
      assert.deepStrictEqual(result, ["a\n\na", "b"]);
    });

    it("uses limit of 1 if input limit is under the length of append/prepend chars", () => {
      const str = `hello world`;
      const limit = 1;
      const appendChar = "ad";
      const prependChar = "ad";

      const result = applySplit(str, {
        limit,
        isEnabled: true,
        appendChar,
        prependChar,
      });

      assert.strictEqual(result[0], `${prependChar}h`);
      result.slice(1, result.length - 1).map((r) => {
        assert.strictEqual(r.length, 1);
      });
      assert.strictEqual(result[result.length - 1], `d${appendChar}`);
    });

    it("splits on periods when available", () => {
      const str = `hello. world.`;
      const limit = 7;

      const result = applySplit(str, {
        limit,
        isEnabled: true,
      });

      assert.deepStrictEqual(result, ["hello.", "world."]);
    });

    it("splits on question marks when available", () => {
      const str = `hello? world?`;
      const limit = 7;

      const result = applySplit(str, {
        limit,
        isEnabled: true,
      });

      assert.deepStrictEqual(result, ["hello?", "world?"]);
    });

    it("splits on exclamation marks when available", () => {
      const str = `hello! world!`;
      const limit = 7;

      const result = applySplit(str, {
        limit,
        isEnabled: true,
      });

      assert.deepStrictEqual(result, ["hello!", "world!"]);
    });

    it("splits on all punctuation when available", () => {
      const str = `hello! world? fate. codinghere!`;
      const limit = 7;

      const result = applySplit(str, {
        limit,
        isEnabled: true,
      });

      assert.deepStrictEqual(result, [
        "hello!",
        "world?",
        "fate.",
        "codingh",
        "ere!",
      ]);
    });
  });

  describe("getNestedPrimitiveValue", () => {
    it("returns a nested string", () => {
      const obj = { foo: { bar: { a: "1" } } };
      const val = getNestedPrimitiveValue(obj, "foo__bar__a");
      assert.strictEqual(val, "1");
    });

    it("returns nested numbers as strings", () => {
      const obj = { foo: { bar: { a: 1 } } };
      const val = getNestedPrimitiveValue(obj, "foo__bar__a");
      assert.strictEqual(val, "1");
    });

    it("returns nested dates as strings", () => {
      const date = new Date("2021-01-01");
      const obj = { foo: { bar: { a: date } } };
      const val = getNestedPrimitiveValue(obj, "foo__bar__a");
      assert.strictEqual(val, date.toISOString());
    });

    it("returns invalid dates as null", () => {
      const date = new Date("abc");
      const obj = { foo: { bar: { a: date } } };
      const val = getNestedPrimitiveValue(obj, "foo__bar__a");
      assert.strictEqual(val, null);
    });

    it("returns objects as null", () => {
      const obj = { foo: { bar: { a: {} } } };
      const val = getNestedPrimitiveValue(obj, "foo__bar__a");
      assert.strictEqual(val, null);
    });

    it("returns arrays as null", () => {
      const obj = { foo: { bar: { a: [] } } };
      const val = getNestedPrimitiveValue(obj, "foo__bar__a");
      assert.strictEqual(val, null);
    });

    it("returns non-existent fields as null", () => {
      const obj = { foo: {} };
      const val = getNestedPrimitiveValue(obj as never, "foo__bar__a");
      assert.strictEqual(val, null);
    });

    it("returns array index values", () => {
      const obj = { foo: { bar: { a: ["a", "b"] } } };
      const val = getNestedPrimitiveValue(obj, "foo__bar__a__1");
      assert.strictEqual(val, "b");
    });

    it("returns null/undefined as null", () => {
      const obj = { foo: { bar: { a: undefined as unknown } } };
      assert.strictEqual(getNestedPrimitiveValue(obj, "foo__bar__a"), null);

      obj.foo.bar.a = null;
      assert.strictEqual(getNestedPrimitiveValue(obj, "foo__bar__a"), null);
    });
  });

  describe("processCustomPlaceholders", () => {
    function createFlattened(
      props: Partial<FlattenedArticle>
    ): FlattenedArticle {
      return {
        id: "test-id",
        idHash: "test-hash",
        ...props,
      };
    }

    describe("Regex step", () => {
      it("replaces matches with replacement string", () => {
        const flattened = createFlattened({ title: "Hello World" });
        const { flattened: result } = processCustomPlaceholders(flattened, [
          {
            id: "test",
            referenceName: "test",
            sourcePlaceholder: "title",
            steps: [
              {
                type: CustomPlaceholderStepType.Regex,
                regexSearch: "Hello",
                replacementString: "Goodbye",
              },
            ],
          },
        ]);
        assert.strictEqual(result["custom::test"], "Goodbye World");
      });

      it("does not modify source placeholder", () => {
        const flattened = createFlattened({ title: "Hello World" });
        const { flattened: result } = processCustomPlaceholders(flattened, [
          {
            id: "test",
            referenceName: "test",
            sourcePlaceholder: "title",
            steps: [
              {
                type: CustomPlaceholderStepType.Regex,
                regexSearch: "Hello",
                replacementString: "Goodbye",
              },
            ],
          },
        ]);
        assert.strictEqual(result["title"], "Hello World");
      });

      it("replaces with empty string if no replacement specified", () => {
        const flattened = createFlattened({ title: "Hello World" });
        const { flattened: result } = processCustomPlaceholders(flattened, [
          {
            id: "test",
            referenceName: "test",
            sourcePlaceholder: "title",
            steps: [
              {
                type: CustomPlaceholderStepType.Regex,
                regexSearch: "Hello ",
              },
            ],
          },
        ]);
        assert.strictEqual(result["custom::test"], "World");
      });

      it("replaces globally", () => {
        const flattened = createFlattened({ title: "Hello Hello World" });
        const { flattened: result } = processCustomPlaceholders(flattened, [
          {
            id: "test",
            referenceName: "test",
            sourcePlaceholder: "title",
            steps: [
              {
                type: CustomPlaceholderStepType.Regex,
                regexSearch: "l",
                replacementString: "z",
              },
            ],
          },
        ]);
        assert.strictEqual(result["custom::test"], "Hezzo Hezzo Worzd");
      });

      it("replaces case-insensitively by default", () => {
        const flattened = createFlattened({ title: "hello HELLO world" });
        const { flattened: result } = processCustomPlaceholders(flattened, [
          {
            id: "test",
            referenceName: "test",
            sourcePlaceholder: "title",
            steps: [
              {
                type: CustomPlaceholderStepType.Regex,
                regexSearch: "hello",
                replacementString: "replaced",
              },
            ],
          },
        ]);
        assert.strictEqual(result["custom::test"], "replaced replaced world");
      });

      it("chains multiple steps", () => {
        const flattened = createFlattened({ title: "hello world" });
        const { flattened: result } = processCustomPlaceholders(flattened, [
          {
            id: "test",
            referenceName: "test",
            sourcePlaceholder: "title",
            steps: [
              {
                type: CustomPlaceholderStepType.Regex,
                regexSearch: "hello",
                replacementString: "goodbye",
              },
              {
                type: CustomPlaceholderStepType.Regex,
                regexSearch: "goodbye",
                replacementString: "farewell",
              },
            ],
          },
        ]);
        assert.strictEqual(result["custom::test"], "farewell world");
      });

      it("returns previews with intermediate step outputs", () => {
        const flattened = createFlattened({ title: "hello world" });
        const { previews } = processCustomPlaceholders(flattened, [
          {
            id: "test",
            referenceName: "test",
            sourcePlaceholder: "title",
            steps: [
              {
                type: CustomPlaceholderStepType.Regex,
                regexSearch: "hello",
                replacementString: "goodbye",
              },
              {
                type: CustomPlaceholderStepType.Uppercase,
              },
            ],
          },
        ]);
        assert.deepStrictEqual(previews, [
          ["hello world", "goodbye world", "GOODBYE WORLD"],
        ]);
      });
    });

    describe("UrlEncode step", () => {
      it("URL encodes the value", () => {
        const flattened = createFlattened({ title: "Hello World!" });
        const { flattened: result } = processCustomPlaceholders(flattened, [
          {
            id: "test",
            referenceName: "test",
            sourcePlaceholder: "title",
            steps: [{ type: CustomPlaceholderStepType.UrlEncode }],
          },
        ]);
        assert.strictEqual(result["custom::test"], "Hello%20World!");
      });

      it("encodes special characters", () => {
        const flattened = createFlattened({
          title: "foo=bar&baz=qux?test#hash",
        });
        const { flattened: result } = processCustomPlaceholders(flattened, [
          {
            id: "test",
            referenceName: "test",
            sourcePlaceholder: "title",
            steps: [{ type: CustomPlaceholderStepType.UrlEncode }],
          },
        ]);
        assert.strictEqual(
          result["custom::test"],
          "foo%3Dbar%26baz%3Dqux%3Ftest%23hash"
        );
      });
    });

    describe("DateFormat step", () => {
      it("formats a valid date", () => {
        const flattened = createFlattened({ date: "2023-06-15T10:30:00Z" });
        const { flattened: result } = processCustomPlaceholders(flattened, [
          {
            id: "test",
            referenceName: "test",
            sourcePlaceholder: "date",
            steps: [
              {
                type: CustomPlaceholderStepType.DateFormat,
                format: "YYYY-MM-DD",
              },
            ],
          },
        ]);
        assert.strictEqual(result["custom::test"], "2023-06-15");
      });

      it("applies timezone", () => {
        const flattened = createFlattened({ date: "2023-06-15T10:30:00Z" });
        const { flattened: result } = processCustomPlaceholders(flattened, [
          {
            id: "test",
            referenceName: "test",
            sourcePlaceholder: "date",
            steps: [
              {
                type: CustomPlaceholderStepType.DateFormat,
                format: "HH:mm",
                timezone: "America/New_York",
              },
            ],
          },
        ]);
        // 10:30 UTC = 06:30 EDT (summer time)
        assert.strictEqual(result["custom::test"], "06:30");
      });

      it("returns empty string for invalid date", () => {
        const flattened = createFlattened({ date: "not-a-date" });
        const { flattened: result } = processCustomPlaceholders(flattened, [
          {
            id: "test",
            referenceName: "test",
            sourcePlaceholder: "date",
            steps: [
              {
                type: CustomPlaceholderStepType.DateFormat,
                format: "YYYY-MM-DD",
              },
            ],
          },
        ]);
        assert.strictEqual(result["custom::test"], "");
      });

      it("returns empty string for invalid timezone", () => {
        const flattened = createFlattened({ date: "2023-06-15T10:30:00Z" });
        const { flattened: result } = processCustomPlaceholders(flattened, [
          {
            id: "test",
            referenceName: "test",
            sourcePlaceholder: "date",
            steps: [
              {
                type: CustomPlaceholderStepType.DateFormat,
                format: "YYYY-MM-DD",
                timezone: "Invalid/Timezone",
              },
            ],
          },
        ]);
        assert.strictEqual(result["custom::test"], "");
      });
    });

    describe("Uppercase step", () => {
      it("converts to uppercase", () => {
        const flattened = createFlattened({ title: "Hello World" });
        const { flattened: result } = processCustomPlaceholders(flattened, [
          {
            id: "test",
            referenceName: "test",
            sourcePlaceholder: "title",
            steps: [{ type: CustomPlaceholderStepType.Uppercase }],
          },
        ]);
        assert.strictEqual(result["custom::test"], "HELLO WORLD");
      });
    });

    describe("Lowercase step", () => {
      it("converts to lowercase", () => {
        const flattened = createFlattened({ title: "Hello World" });
        const { flattened: result } = processCustomPlaceholders(flattened, [
          {
            id: "test",
            referenceName: "test",
            sourcePlaceholder: "title",
            steps: [{ type: CustomPlaceholderStepType.Lowercase }],
          },
        ]);
        assert.strictEqual(result["custom::test"], "hello world");
      });
    });

    describe("missing source placeholder", () => {
      it("returns empty string if source does not exist", () => {
        const flattened = createFlattened({});
        const { flattened: result } = processCustomPlaceholders(flattened, [
          {
            id: "test",
            referenceName: "test",
            sourcePlaceholder: "nonexistent",
            steps: [
              {
                type: CustomPlaceholderStepType.Regex,
                regexSearch: "foo",
                replacementString: "bar",
              },
            ],
          },
        ]);
        assert.strictEqual(result["custom::test"], "");
      });
    });
  });
});
