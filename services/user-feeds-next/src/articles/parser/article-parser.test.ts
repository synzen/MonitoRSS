import { describe, it } from "node:test";
import assert from "node:assert";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import {
  parseArticlesFromXml,
  flattenArticle,
  InvalidFeedException,
  ARTICLE_FIELD_DELIMITER,
} from ".";

dayjs.extend(timezone);
dayjs.extend(utc);

const DL = ARTICLE_FIELD_DELIMITER;

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Sample Feed</title>
    <link>https://example.com</link>
    <description>A sample RSS feed for testing</description>
    <item>
      <title>First Article</title>
      <link>https://example.com/article1</link>
      <description>This is the first article</description>
      <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
      <guid>article-1</guid>
    </item>
    <item>
      <title>Second Article</title>
      <link>https://example.com/article2</link>
      <description>This is the second article</description>
      <pubDate>Tue, 02 Jan 2024 12:00:00 GMT</pubDate>
      <guid>article-2</guid>
    </item>
  </channel>
</rss>`;

const SAMPLE_ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <link href="https://example.com"/>
  <entry>
    <title>Atom Entry</title>
    <link href="https://example.com/entry1"/>
    <id>urn:uuid:1234</id>
    <updated>2024-01-01T12:00:00Z</updated>
    <summary>An Atom entry</summary>
  </entry>
</feed>`;

describe("article-parser", { concurrency: true }, () => {
  describe("parseArticlesFromXml", () => {
    it("parses RSS feed correctly", async () => {
      const result = await parseArticlesFromXml(SAMPLE_RSS);

      assert.strictEqual(result.feed.title, "Sample Feed");
      assert.strictEqual(result.articles.length, 2);

      const firstArticle = result.articles[0]!;
      assert.strictEqual(firstArticle.flattened.title, "First Article");
      assert.strictEqual(firstArticle.flattened.link, "https://example.com/article1");
      assert.notStrictEqual(firstArticle.flattened.id, undefined);
      assert.notStrictEqual(firstArticle.flattened.idHash, undefined);
    });

    it("parses Atom feed correctly", async () => {
      const result = await parseArticlesFromXml(SAMPLE_ATOM);

      assert.strictEqual(result.feed.title, "Atom Feed");
      assert.strictEqual(result.articles.length, 1);

      const entry = result.articles[0]!;
      assert.strictEqual(entry.flattened.title, "Atom Entry");
      assert.notStrictEqual(entry.flattened.id, undefined);
    });

    it("throws InvalidFeedException for invalid XML", async () => {
      await assert.rejects(
        parseArticlesFromXml("not valid xml"),
        InvalidFeedException
      );
    });

    it("throws InvalidFeedException for non-feed XML", async () => {
      const html = "<html><body>Not a feed</body></html>";
      await assert.rejects(
        parseArticlesFromXml(html),
        InvalidFeedException
      );
    });

    it("applies date format options", async () => {
      const result = await parseArticlesFromXml(SAMPLE_RSS, {
        formatOptions: {
          dateFormat: "YYYY-MM-DD",
          dateTimezone: "UTC",
        },
      });

      // The pubdate field should be formatted
      const firstArticle = result.articles[0]!;
      assert.strictEqual(firstArticle.flattened.pubdate, "2024-01-01");
    });

    it("returns empty articles array for empty feed", async () => {
      const emptyFeed = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <title>Empty Feed</title>
          </channel>
        </rss>`;

      const result = await parseArticlesFromXml(emptyFeed);
      assert.strictEqual(result.articles.length, 0);
      assert.strictEqual(result.feed.title, "Empty Feed");
    });

    it("extracts images from description HTML", async () => {
      const feedWithImages = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <title>Feed With Images</title>
            <item>
              <title>Article with image</title>
              <description><![CDATA[<p>Text <img src="https://example.com/image.jpg" /></p>]]></description>
              <guid>image-article</guid>
            </item>
          </channel>
        </rss>`;

      const result = await parseArticlesFromXml(feedWithImages);
      const article = result.articles[0]!;

      // Should have extracted image
      assert.strictEqual(article.flattened["extracted::description::image1"], "https://example.com/image.jpg");
    });
  });

  describe("flatten", () => {
    it("flattens nested objects", () => {
      const article = {
        id: "hello world",
        author: {
          name: {
            tag: "tag",
          },
        },
      };

      const flattenedArticle = flattenArticle(article, {
        useParserRules: [],
      });

      assert.strictEqual(flattenedArticle.id, article.id);
      assert.strictEqual(flattenedArticle[`author${DL}name${DL}tag`], article.author.name.tag);
    });

    it("flattens categories into a single string", () => {
      const article = {
        categories: ["cat1", "cat2", "cat3"],
      };

      const flattenedArticle = flattenArticle(article, {
        useParserRules: [],
      });

      assert.strictEqual(flattenedArticle["processed::categories"], "cat1,cat2,cat3");
    });

    it("flattens arrays", () => {
      const article = {
        id: "hello world",
        tags: ["tag1", "tag2"],
      };

      const flattenedArticle = flattenArticle(article, {
        useParserRules: [],
      });

      assert.strictEqual(flattenedArticle.id, article.id);
      assert.strictEqual(flattenedArticle[`tags${DL}0`], article.tags[0]);
      assert.strictEqual(flattenedArticle[`tags${DL}1`], article.tags[1]);
    });

    it("flattens arrays of objects", () => {
      const article = {
        id: "hello world",
        tags: [
          {
            name: "tag1",
          },
          {
            name: "tag2",
          },
        ],
      };

      const flattenedArticle = flattenArticle(article, {
        useParserRules: [],
      });

      assert.strictEqual(flattenedArticle.id, article.id);
      assert.strictEqual(flattenedArticle[`tags${DL}0${DL}name`], article.tags[0]!.name);
      assert.strictEqual(flattenedArticle[`tags${DL}1${DL}name`], article.tags[1]!.name);
    });

    it("flattens arrays of objects with arrays", () => {
      const article = {
        id: "hello world",
        tags: [
          {
            name: "tag1",
            aliases: ["alias1", "alias2"],
          },
          {
            name: "tag2",
            aliases: ["alias3", "alias4"],
          },
        ],
      };

      const flattenedArticle = flattenArticle(article, {
        useParserRules: [],
      });

      assert.strictEqual(flattenedArticle.id, article.id);
      assert.strictEqual(flattenedArticle[`tags${DL}0${DL}name`], article.tags[0]!.name);
      assert.strictEqual(flattenedArticle[`tags${DL}0${DL}aliases${DL}0`], article.tags[0]!.aliases[0]);
      assert.strictEqual(flattenedArticle[`tags${DL}0${DL}aliases${DL}1`], article.tags[0]!.aliases[1]);
      assert.strictEqual(flattenedArticle[`tags${DL}1${DL}name`], article.tags[1]!.name);
      assert.strictEqual(flattenedArticle[`tags${DL}1${DL}aliases${DL}0`], article.tags[1]!.aliases[0]);
      assert.strictEqual(flattenedArticle[`tags${DL}1${DL}aliases${DL}1`], article.tags[1]!.aliases[1]);
    });

    it("handles keys with the delimiter in it", () => {
      const article = {
        id: "hello world",
        a: {
          [`${DL}b`]: "c",
        },
      };

      const flattenedArticle = flattenArticle(article, {
        useParserRules: [],
      });

      assert.strictEqual(flattenedArticle.id, article.id);
      assert.strictEqual(flattenedArticle[`a${DL}${DL}b`], article.a[`${DL}b`]);
    });

    (
      [
        { val: null, desc: "null" },
        { val: undefined, desc: "undefined" },
        { val: "", desc: "empty string" },
        { val: " ", desc: "whitespace" },
      ] as const
    ).forEach(({ val, desc }) => {
      it(`excludes ${desc} values from the final object`, () => {
        const article = {
          id: "hello world",
          a: val,
          b: {
            c: {
              d: val,
            },
          },
        };

        const flattenedArticle = flattenArticle(article, {
          useParserRules: [],
        });

        assert.strictEqual(flattenedArticle.id, article.id);
        assert.strictEqual(flattenedArticle.a, undefined);
        assert.strictEqual(flattenedArticle[`b${DL}c${DL}d`], undefined);
      });
    });

    it("omits null values", () => {
      const article = {
        id: "hello world",
        a: null,
        b: {
          c: {
            d: {
              e: null,
            },
          },
        },
      };

      const flattenedArticle = flattenArticle(article, {
        useParserRules: [],
      });

      assert.strictEqual(flattenedArticle.id, article.id);
      assert.strictEqual(flattenedArticle.a, undefined);
      assert.strictEqual(flattenedArticle[`b${DL}c${DL}d${DL}e`], undefined);
    });

    it("removes empty objects", () => {
      const article = {
        id: "hello world",
        a: {},
        b: {
          c: {
            d: {
              e: {},
            },
          },
        },
      };

      const flattenedArticle = flattenArticle(article, {
        useParserRules: [],
      });

      assert.strictEqual(flattenedArticle.id, article.id);
      assert.strictEqual(flattenedArticle.a, undefined);
      assert.strictEqual(flattenedArticle[`b${DL}c${DL}d${DL}e`], undefined);
    });

    it("removes empty arrays", () => {
      const article = {
        id: "hello world",
        a: [],
        b: {
          c: {
            d: {
              e: [],
            },
          },
        },
      };

      const flattenedArticle = flattenArticle(article, {
        useParserRules: [],
      });

      assert.strictEqual(flattenedArticle.id, article.id);
      assert.strictEqual(flattenedArticle.a, undefined);
      assert.strictEqual(flattenedArticle[`b${DL}c${DL}d${DL}e`], undefined);
    });

    it("converts numbers to strings", () => {
      const article = {
        id: "hello world",
        a: 1,
        b: {
          c: {
            d: {
              e: 2,
            },
          },
        },
      };

      const flattenedArticle = flattenArticle(article, {
        useParserRules: [],
      });

      assert.strictEqual(flattenedArticle.id, article.id);
      assert.strictEqual(flattenedArticle.a, "1");
      assert.strictEqual(flattenedArticle[`b${DL}c${DL}d${DL}e`], "2");
    });

    it("extracts images", () => {
      const article = {
        id: "123",
        description:
          'hello <img src="https://example.com/image.jpg" />' +
          ' world <img src="https://example.com/image2.jpg" />',
        summary: "hello world <img src='https://example.com/image3.jpg' />",
      };

      const flattenedArticle = flattenArticle(article, {
        useParserRules: [],
      });

      assert.strictEqual(flattenedArticle[`extracted::description::image1`], "https://example.com/image.jpg");
      assert.strictEqual(flattenedArticle[`extracted::description::image2`], "https://example.com/image2.jpg");
      assert.strictEqual(flattenedArticle[`extracted::summary::image1`], "https://example.com/image3.jpg");
    });

    it("extracts anchors", () => {
      const article = {
        id: "123",
        description: 'hello <a href="https://example.com">world</a>',
        summary: 'hello world <a href="https://example.com">world</a>',
      };

      const flattenedArticle = flattenArticle(article, {
        useParserRules: [],
      });

      assert.strictEqual(flattenedArticle[`extracted::description::anchor1`], "https://example.com");
      assert.strictEqual(flattenedArticle[`extracted::summary::anchor1`], "https://example.com");
    });
  });

  describe("dates", () => {
    it("converts dates to ISO strings", () => {
      const article = {
        id: "hello world",
        a: new Date(),
        b: {
          c: {
            d: {
              e: new Date(),
            },
          },
        },
      };

      const flattenedArticle = flattenArticle(article, {
        useParserRules: [],
      });

      assert.strictEqual(flattenedArticle.id, article.id);
      assert.strictEqual(flattenedArticle.a, dayjs(article.a).tz("UTC").locale("en").format());
      assert.strictEqual(flattenedArticle[`b${DL}c${DL}d${DL}e`], dayjs(article.b.c.d.e).tz("UTC").locale("en").format());
    });

    it("converts dates to ISO strings with a custom date format", () => {
      const article = {
        id: "hello world",
        a: new Date(),
        b: {
          c: {
            d: {
              e: new Date(),
            },
          },
        },
      };

      const dateFormat = "YYYY-MM-DD";

      const flattenedArticle = flattenArticle(article, {
        formatOptions: {
          dateFormat,
          dateTimezone: undefined,
          dateLocale: undefined,
        },
        useParserRules: [],
      });

      assert.strictEqual(flattenedArticle.id, article.id);
      assert.strictEqual(flattenedArticle.a, dayjs(article.a).tz("UTC").locale("en").format(dateFormat));
      assert.strictEqual(flattenedArticle[`b${DL}c${DL}d${DL}e`], dayjs(article.b.c.d.e).tz("UTC").locale("en").format(dateFormat));
    });

    it("converts dates to ISO strings with advanced custom date formats", () => {
      const date = new Date(2020, 1, 1);
      const article = {
        id: "hello world",
        a: date,
      };

      const dateFormat = "x";

      const flattenedArticle = flattenArticle(article, {
        formatOptions: {
          dateFormat,
          dateTimezone: undefined,
          dateLocale: undefined,
        },
        useParserRules: [],
      });

      assert.ok(/^\d+$/.test(flattenedArticle.a));
    });

    it("works with custom timezones", () => {
      const article = {
        id: "hello world",
        a: new Date(),
        b: {
          c: {
            d: {
              e: new Date(),
            },
          },
        },
      };

      const dateTimezone = "America/New_York";

      const flattenedArticle = flattenArticle(article, {
        formatOptions: {
          dateFormat: undefined,
          dateTimezone,
          dateLocale: undefined,
        },
        useParserRules: [],
      });

      assert.strictEqual(flattenedArticle.id, article.id);
      assert.strictEqual(flattenedArticle.a, dayjs(article.a).tz(dateTimezone).format());
      assert.strictEqual(flattenedArticle[`b${DL}c${DL}d${DL}e`], dayjs(article.b.c.d.e).tz(dateTimezone).format());
    });

    it("falls back to UTC for invalid timezones", () => {
      const date = new Date("2024-01-15T12:00:00Z");
      const article = {
        id: "hello world",
        a: date,
      };

      // Unicode minus character (U+2212) instead of ASCII hyphen
      const invalidTimezone = "−04:00";

      const flattenedArticle = flattenArticle(article, {
        formatOptions: {
          dateFormat: undefined,
          dateTimezone: invalidTimezone,
          dateLocale: undefined,
        },
        useParserRules: [],
      });

      // Should fall back to UTC instead of throwing
      assert.strictEqual(flattenedArticle.a, dayjs(date).utc().locale("en").format());
    });
  });
});
