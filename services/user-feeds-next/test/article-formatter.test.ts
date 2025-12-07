import { describe, expect, it } from "bun:test";
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
} from "../src/article-formatter";
import {
  ExpressionType,
  LogicalExpressionOperator,
  RelationalExpressionOperator,
  RelationalExpressionLeft,
  RelationalExpressionRight,
} from "../src/article-filters";
import type { Article, FlattenedArticle } from "../src/article-parser";

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
      expect(result).toBe("Title: Hello World");
    });

    it("replaces multiple placeholders", () => {
      const result = replaceTemplateString(
        { title: "Hello", author: "John" },
        "{{title}} by {{author}}"
      );
      expect(result).toBe("Hello by John");
    });

    it("replaces with empty string for missing placeholders", () => {
      const result = replaceTemplateString(
        { title: "Hello" },
        "{{title}} - {{missing}}"
      );
      expect(result).toBe("Hello - ");
    });

    it("supports fallback syntax", () => {
      const result = replaceTemplateString(
        { title: "Hello" },
        "{{missing||title}}",
        { supportFallbacks: true }
      );
      expect(result).toBe("Hello");
    });

    it("supports text:: fallback", () => {
      const result = replaceTemplateString(
        {},
        "{{missing||text::Default Text}}",
        { supportFallbacks: true }
      );
      expect(result).toBe("Default Text");
    });

    it("uses first non-empty value in fallback chain", () => {
      const result = replaceTemplateString(
        { third: "Third Value" },
        "{{first||second||third}}",
        { supportFallbacks: true }
      );
      expect(result).toBe("Third Value");
    });
  });

  describe("applySplit", () => {
    it("returns single item for short text", () => {
      const result = applySplit("Hello World", { limit: 100 });
      expect(result.length).toBe(1);
      expect(result[0]).toBe("Hello World");
    });

    it("truncates long text by default", () => {
      const longText = "A".repeat(100);
      const result = applySplit(longText, { limit: 50 });
      expect(result.length).toBe(1);
      expect(result[0]!.length).toBeLessThanOrEqual(50);
    });

    it("splits into multiple parts when enabled", () => {
      const longText = "A".repeat(100);
      const result = applySplit(longText, { limit: 50, isEnabled: true });
      expect(result.length).toBeGreaterThan(1);
    });

    it("handles undefined input", () => {
      const result = applySplit(undefined);
      expect(result).toEqual([""]);
    });
  });

  describe("generateDiscordPayloads", () => {
    it("generates payload with content", () => {
      const article = createArticle({ title: "Test Title" });
      const payloads = generateDiscordPayloads(article, {
        content: "New article: {{title}}",
      });

      expect(payloads.length).toBe(1);
      expect(payloads[0]!.content).toBe("New article: Test Title");
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

      expect(payloads.length).toBe(1);
      expect(payloads[0]!.embeds?.length).toBe(1);
      expect(payloads[0]!.embeds?.[0]?.title).toBe("Test Title");
      expect(payloads[0]!.embeds?.[0]?.description).toBe("Test Desc");
      expect(payloads[0]!.embeds?.[0]?.color).toBe(0x00ff00);
    });

    it("filters out empty payloads", () => {
      const article = createArticle({});
      const payloads = generateDiscordPayloads(article, {
        content: "{{missing}}",
        embeds: [],
      });

      expect(payloads.length).toBe(0);
    });

    it("truncates embed fields to Discord limits", () => {
      const article = createArticle({ title: "A".repeat(500) });
      const payloads = generateDiscordPayloads(article, {
        embeds: [{ title: "{{title}}" }],
      });

      expect(payloads[0]!.embeds?.[0]?.title?.length).toBeLessThanOrEqual(256);
    });

    it("supports placeholder fallbacks", () => {
      const article = createArticle({ backup: "Backup Title" });
      const payloads = generateDiscordPayloads(article, {
        content: "{{title||backup}}",
        enablePlaceholderFallback: true,
      });

      expect(payloads[0]!.content).toBe("Backup Title");
    });

    it("adds timestamp when configured", () => {
      const article = createArticle({});
      article.raw.date = "2024-01-01T12:00:00Z";

      const payloads = generateDiscordPayloads(article, {
        embeds: [{ title: "Test", timestamp: "article" }],
      });

      expect(payloads[0]!.embeds?.[0]?.timestamp).toBeDefined();
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

        expect(payloads.length).toBe(1);
        expect(payloads[0]!.flags).toBe(DISCORD_COMPONENTS_V2_FLAG);
        expect(payloads[0]!.components).toBeDefined();
        expect(payloads[0]!.content).toBeUndefined();
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

        expect(payloads.length).toBe(1);
        expect(payloads[0]!.flags).toBe(DISCORD_COMPONENTS_V2_FLAG);
        // V2 takes precedence, content should not be present
        expect(payloads[0]!.content).toBeUndefined();
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

        expect(payloads.length).toBe(1);
        expect(payloads[0]!.content).toBe("Hello Test");
        expect(payloads[0]!.components).toBeDefined();
        expect(payloads[0]!.components!.length).toBe(1);
        // Check the button label has placeholder replaced
        const actionRow = payloads[0]!.components![0] as {
          components: Array<{ label: string }>;
        };
        expect(actionRow.components[0]!.label).toBe("Test");
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

        expect(payloads[0]!.flags).toBeUndefined();
      });
    });
  });

  describe("generateThreadName", () => {
    it("replaces placeholders in template", () => {
      const article = createArticle({ title: "My Article Title" });
      const name = generateThreadName(article, "New: {{title}}", {});
      expect(name).toBe("New: My Article Title");
    });

    it("uses default template if not provided", () => {
      const article = createArticle({ title: "Default Title" });
      const name = generateThreadName(article, null, {});
      expect(name).toBe("Default Title");
    });

    it("falls back to 'New Article' if no title", () => {
      const article = createArticle({});
      const name = generateThreadName(article, null, {});
      expect(name).toBe("New Article");
    });

    it("truncates to 100 characters", () => {
      const article = createArticle({ title: "A".repeat(200) });
      const name = generateThreadName(article, "{{title}}", {});
      expect(name.length).toBeLessThanOrEqual(100);
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

      expect(body.thread_name).toBe("My Thread");
      expect(body.applied_tags).toEqual(["tag1", "tag2"]);
      expect(body.content).toBe("Test");
    });

    it("builds channel forum body with name and message", () => {
      const payload = { content: "Test" };
      const body = buildForumThreadBody({
        isWebhook: false,
        threadName: "My Thread",
        firstPayload: payload,
        tags: ["tag1"],
      });

      expect(body.name).toBe("My Thread");
      expect(body.message).toBe(payload);
      expect(body.type).toBe(11);
      expect(body.applied_tags).toEqual(["tag1"]);
    });
  });

  describe("getForumTagsToSend", () => {
    it("returns all tag IDs when no filters", () => {
      const article = createArticle({ title: "Test" });
      const tags = getForumTagsToSend(
        [{ id: "tag1" }, { id: "tag2" }],
        article
      );
      expect(tags).toEqual(["tag1", "tag2"]);
    });

    it("returns empty array for null tags", () => {
      const article = createArticle({});
      expect(getForumTagsToSend(null, article)).toEqual([]);
      expect(getForumTagsToSend(undefined, article)).toEqual([]);
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
      expect(tags).toEqual(["tech-tag"]);
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

      expect(enhanced[0]!.username).toBe("Bot: John");
      expect(enhanced[0]!.avatar_url).toBe("https://avatar.com/John.png");
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

      expect(enhanced[0]!.username!.length).toBeLessThanOrEqual(256);
    });
  });

  describe("formatValueForDiscord", () => {
    describe("div", () => {
      it("ignores when there are no children", () => {
        const value = "<div>hello <div></div></div>";
        const result = formatValueForDiscord(value);
        expect(result.value).toBe("hello");
      });
    });

    describe("br", () => {
      it("adds a newline", () => {
        const value = "hello<br />world";
        const result = formatValueForDiscord(value);
        expect(result.value).toBe("hello\nworld");
      });
    });

    describe("new lines", () => {
      it("adds new lines", () => {
        const value = "hello\nworld";
        const result = formatValueForDiscord(value);
        expect(result.value).toBe("hello\nworld");
      });
    });

    describe("a (anchors)", () => {
      it("returns the text with the link", () => {
        const value = 'Say <a href="https://example.com">Hello World</a> to me';
        const result = formatValueForDiscord(value);
        expect(result.value).toBe(
          "Say [Hello World](https://example.com) to me"
        );
      });

      it("does not return an anchor if the href is the same as the text", () => {
        const value =
          'Say <a href="https://example.com">https://example.com</a> to me';
        const result = formatValueForDiscord(value);
        expect(result.value).toBe("Say https://example.com to me");
      });

      it("works with nested inline elements", () => {
        const value = `<a href="https://example.com"><strong>Hello World</strong></a>`;
        const result = formatValueForDiscord(value);
        expect(result.value).toBe("[**Hello World**](https://example.com)");
      });
    });

    describe("img", () => {
      it("returns the image link with no alt", () => {
        const value = '<img src="https://example.com/image.png" />';
        const result = formatValueForDiscord(value);
        expect(result.value).toBe("https://example.com/image.png");
      });

      it("returns the image link with an alt", () => {
        const value =
          '<img src="https://example.com/image.png" alt="this should not show" />';
        const result = formatValueForDiscord(value);
        expect(result.value).toBe("https://example.com/image.png");
      });

      it("excludes the image if strip image option is true", () => {
        const value = 'Hello <img src="https://example.com/image.png" /> World';
        const result = formatValueForDiscord(value, {
          stripImages: true,
          formatTables: false,
          disableImageLinkPreviews: false,
        });
        expect(result.value).toBe("Hello World");
      });

      it("wraps links with < and > when disable image link previews is true", () => {
        const value =
          'Hello <img src="https://example.com/image.png" /> World <img src="https://example.com/image2.png" />';
        const result = formatValueForDiscord(value, {
          stripImages: false,
          formatTables: false,
          disableImageLinkPreviews: true,
        });
        expect(result.value).toBe(
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
          expect(result.value).toBe("**hello world**");
        });
      });
    });

    describe("strong", () => {
      it("returns the text bolded", () => {
        const value = "a <strong>hello world</strong> b";
        const result = formatValueForDiscord(value);
        expect(result.value).toBe("a **hello world** b");
      });

      it("does not add new newlines", () => {
        const value = `<p>First <strong>Before</strong>:</p>`;
        const result = formatValueForDiscord(value);
        expect(result.value).toBe("First **Before**:");
      });

      it("adds spaces around it", () => {
        const value = `this <strong>is</strong> bold`;
        const result = formatValueForDiscord(value);
        expect(result.value).toBe("this **is** bold");
      });
    });

    describe("code", () => {
      it("returns the text in an inline code block", () => {
        const value = "<code>hello world</code>";
        const result = formatValueForDiscord(value);
        expect(result.value).toBe("`hello world`");
      });

      it("does not add new line before starting tag", () => {
        const value = `<p>First <code>Before</code>:</p>`;
        const result = formatValueForDiscord(value);
        expect(result.value).toBe("First `Before`:");
      });
    });

    describe("pre", () => {
      it("returns the text in a code block", () => {
        const value = "<pre>hello world</pre>";
        const result = formatValueForDiscord(value);
        expect(result.value).toBe("```hello world```");
      });

      it('returns the text in a code block if its only child is a "code" element with a text node', () => {
        const value = "<pre><code>hello world</code></pre>";
        const result = formatValueForDiscord(value);
        expect(result.value).toBe("```hello world```");
      });
    });

    describe("em", () => {
      it("returns the text italicized", () => {
        const value = "<em>hello world</em>";
        const result = formatValueForDiscord(value);
        expect(result.value).toBe("*hello world*");
      });
    });

    describe("u", () => {
      it("returns the text underlined", () => {
        const value = "<u>hello world</u>";
        const result = formatValueForDiscord(value);
        expect(result.value).toBe("__hello world__");
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

        expect(result.value).toBe(
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
        expect(result.value).toBe("* 1\n* 2");
      });
    });

    describe("paragraphs", () => {
      it("works with nested paragraphs", () => {
        const val = `
        <p>hello <strong>world 😀</strong> <p>another example</p></p>
        `;
        const result = formatValueForDiscord(val);
        expect(result.value).toBe("hello **world 😀** \n\nanother example");
      });

      it("does not add extra newlines for empty paragraphs", () => {
        const val = `
        <p>hello world <p></p>Hello world</p>
        `;
        const result = formatValueForDiscord(val);
        expect(result.value).toBe("hello world \n\nHello world");
      });
    });
  });

  describe("applySplit edge cases", () => {
    it("does not apply split if split is not enabled", () => {
      const result = applySplit("hello world", {
        isEnabled: false,
      });
      expect(result).toEqual(["hello world"]);
    });

    it("applies split with a low limit", () => {
      const result = applySplit("hello world", {
        limit: 4,
        isEnabled: true,
        appendChar: "",
        prependChar: "",
      });
      expect(result).toEqual(["hell", "o", "worl", "d"]);
    });

    it("returns an empty string if input text is empty", () => {
      const result = applySplit("");
      expect(result).toEqual([""]);
    });

    it("applies split with a high limit", () => {
      const result = applySplit("hello world", {
        limit: 100,
        isEnabled: true,
        appendChar: "",
        prependChar: "",
      });
      expect(result).toEqual(["hello world"]);
    });

    it("does not add append char if there was nothing to split on", () => {
      const result = applySplit("hello world", {
        limit: 100,
        isEnabled: true,
        appendChar: "!",
        prependChar: "",
      });
      expect(result).toEqual(["hello world"]);
    });

    it("does not add prepend char if there was nothing to split on", () => {
      const result = applySplit("hello world", {
        limit: 100,
        isEnabled: true,
        appendChar: "",
        prependChar: "!",
      });
      expect(result).toEqual(["hello world"]);
    });

    it("does not add append and prepend char if there was nothing to split on", () => {
      const result = applySplit("hello world", {
        limit: 100,
        isEnabled: true,
        appendChar: "!",
        prependChar: "!",
      });
      expect(result).toEqual(["hello world"]);
    });

    it("applies split with a high limit and append and prepend char and multiple lines", () => {
      const result = applySplit("hello world\nhello world", {
        limit: 16,
        isEnabled: true,
        appendChar: "!",
        prependChar: "!",
      });
      expect(result).toEqual(["!hello world", "hello world!"]);
    });

    it("does not create duplicate split chars with multiple new lines", () => {
      const result = applySplit("hello world.\n\n\nhello world.\n\n\n", {
        limit: 5,
        isEnabled: true,
      });
      expect(result).toEqual(["hello", "world", ".", "hello", "world", "."]);
    });

    it("should preserve double new lines when possible", () => {
      const result = applySplit(`a\n\na\n\nb`.trim(), {
        limit: 4,
        isEnabled: true,
      });
      expect(result).toEqual(["a\n\na", "b"]);
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

      expect(result[0]).toBe(`${prependChar}h`);
      result.slice(1, result.length - 1).map((r) => {
        expect(r.length).toBe(1);
      });
      expect(result[result.length - 1]).toBe(`d${appendChar}`);
    });

    it("splits on periods when available", () => {
      const str = `hello. world.`;
      const limit = 7;

      const result = applySplit(str, {
        limit,
        isEnabled: true,
      });

      expect(result).toEqual(["hello.", "world."]);
    });

    it("splits on question marks when available", () => {
      const str = `hello? world?`;
      const limit = 7;

      const result = applySplit(str, {
        limit,
        isEnabled: true,
      });

      expect(result).toEqual(["hello?", "world?"]);
    });

    it("splits on exclamation marks when available", () => {
      const str = `hello! world!`;
      const limit = 7;

      const result = applySplit(str, {
        limit,
        isEnabled: true,
      });

      expect(result).toEqual(["hello!", "world!"]);
    });

    it("splits on all punctuation when available", () => {
      const str = `hello! world? fate. codinghere!`;
      const limit = 7;

      const result = applySplit(str, {
        limit,
        isEnabled: true,
      });

      expect(result).toEqual(["hello!", "world?", "fate.", "codingh", "ere!"]);
    });
  });

  describe("getNestedPrimitiveValue", () => {
    it("returns a nested string", () => {
      const obj = { foo: { bar: { a: "1" } } };
      const val = getNestedPrimitiveValue(obj, "foo__bar__a");
      expect(val).toBe("1");
    });

    it("returns nested numbers as strings", () => {
      const obj = { foo: { bar: { a: 1 } } };
      const val = getNestedPrimitiveValue(obj, "foo__bar__a");
      expect(val).toBe("1");
    });

    it("returns nested dates as strings", () => {
      const date = new Date("2021-01-01");
      const obj = { foo: { bar: { a: date } } };
      const val = getNestedPrimitiveValue(obj, "foo__bar__a");
      expect(val).toBe(date.toISOString());
    });

    it("returns invalid dates as null", () => {
      const date = new Date("abc");
      const obj = { foo: { bar: { a: date } } };
      const val = getNestedPrimitiveValue(obj, "foo__bar__a");
      expect(val).toBe(null);
    });

    it("returns objects as null", () => {
      const obj = { foo: { bar: { a: {} } } };
      const val = getNestedPrimitiveValue(obj, "foo__bar__a");
      expect(val).toBe(null);
    });

    it("returns arrays as null", () => {
      const obj = { foo: { bar: { a: [] } } };
      const val = getNestedPrimitiveValue(obj, "foo__bar__a");
      expect(val).toBe(null);
    });

    it("returns non-existent fields as null", () => {
      const obj = { foo: {} };
      const val = getNestedPrimitiveValue(obj as never, "foo__bar__a");
      expect(val).toBe(null);
    });

    it("returns array index values", () => {
      const obj = { foo: { bar: { a: ["a", "b"] } } };
      const val = getNestedPrimitiveValue(obj, "foo__bar__a__1");
      expect(val).toBe("b");
    });

    it("returns null/undefined as null", () => {
      const obj = { foo: { bar: { a: undefined as unknown } } };
      expect(getNestedPrimitiveValue(obj, "foo__bar__a")).toBe(null);

      obj.foo.bar.a = null;
      expect(getNestedPrimitiveValue(obj, "foo__bar__a")).toBe(null);
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
        const result = processCustomPlaceholders(flattened, [
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
        expect(result["custom::test"]).toBe("Goodbye World");
      });

      it("does not modify source placeholder", () => {
        const flattened = createFlattened({ title: "Hello World" });
        const result = processCustomPlaceholders(flattened, [
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
        expect(result["title"]).toBe("Hello World");
      });

      it("replaces with empty string if no replacement specified", () => {
        const flattened = createFlattened({ title: "Hello World" });
        const result = processCustomPlaceholders(flattened, [
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
        expect(result["custom::test"]).toBe("World");
      });

      it("replaces globally", () => {
        const flattened = createFlattened({ title: "Hello Hello World" });
        const result = processCustomPlaceholders(flattened, [
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
        expect(result["custom::test"]).toBe("Hezzo Hezzo Worzd");
      });

      it("replaces case-insensitively by default", () => {
        const flattened = createFlattened({ title: "hello HELLO world" });
        const result = processCustomPlaceholders(flattened, [
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
        expect(result["custom::test"]).toBe("replaced replaced world");
      });

      it("chains multiple steps", () => {
        const flattened = createFlattened({ title: "hello world" });
        const result = processCustomPlaceholders(flattened, [
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
        expect(result["custom::test"]).toBe("farewell world");
      });
    });

    describe("UrlEncode step", () => {
      it("URL encodes the value", () => {
        const flattened = createFlattened({ title: "Hello World!" });
        const result = processCustomPlaceholders(flattened, [
          {
            id: "test",
            referenceName: "test",
            sourcePlaceholder: "title",
            steps: [{ type: CustomPlaceholderStepType.UrlEncode }],
          },
        ]);
        expect(result["custom::test"]).toBe("Hello%20World!");
      });

      it("encodes special characters", () => {
        const flattened = createFlattened({
          title: "foo=bar&baz=qux?test#hash",
        });
        const result = processCustomPlaceholders(flattened, [
          {
            id: "test",
            referenceName: "test",
            sourcePlaceholder: "title",
            steps: [{ type: CustomPlaceholderStepType.UrlEncode }],
          },
        ]);
        expect(result["custom::test"]).toBe(
          "foo%3Dbar%26baz%3Dqux%3Ftest%23hash"
        );
      });
    });

    describe("DateFormat step", () => {
      it("formats a valid date", () => {
        const flattened = createFlattened({ date: "2023-06-15T10:30:00Z" });
        const result = processCustomPlaceholders(flattened, [
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
        expect(result["custom::test"]).toBe("2023-06-15");
      });

      it("applies timezone", () => {
        const flattened = createFlattened({ date: "2023-06-15T10:30:00Z" });
        const result = processCustomPlaceholders(flattened, [
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
        expect(result["custom::test"]).toBe("06:30");
      });

      it("returns empty string for invalid date", () => {
        const flattened = createFlattened({ date: "not-a-date" });
        const result = processCustomPlaceholders(flattened, [
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
        expect(result["custom::test"]).toBe("");
      });

      it("returns empty string for invalid timezone", () => {
        const flattened = createFlattened({ date: "2023-06-15T10:30:00Z" });
        const result = processCustomPlaceholders(flattened, [
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
        expect(result["custom::test"]).toBe("");
      });
    });

    describe("Uppercase step", () => {
      it("converts to uppercase", () => {
        const flattened = createFlattened({ title: "Hello World" });
        const result = processCustomPlaceholders(flattened, [
          {
            id: "test",
            referenceName: "test",
            sourcePlaceholder: "title",
            steps: [{ type: CustomPlaceholderStepType.Uppercase }],
          },
        ]);
        expect(result["custom::test"]).toBe("HELLO WORLD");
      });
    });

    describe("Lowercase step", () => {
      it("converts to lowercase", () => {
        const flattened = createFlattened({ title: "Hello World" });
        const result = processCustomPlaceholders(flattened, [
          {
            id: "test",
            referenceName: "test",
            sourcePlaceholder: "title",
            steps: [{ type: CustomPlaceholderStepType.Lowercase }],
          },
        ]);
        expect(result["custom::test"]).toBe("hello world");
      });
    });

    describe("missing source placeholder", () => {
      it("returns empty string if source does not exist", () => {
        const flattened = createFlattened({});
        const result = processCustomPlaceholders(flattened, [
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
        expect(result["custom::test"]).toBe("");
      });
    });
  });
});
