import { describe, expect, it } from "bun:test";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import {
  parseArticlesFromXml,
  flattenArticle,
  InvalidFeedException,
  ARTICLE_FIELD_DELIMITER,
} from "../src/article-parser";

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

describe("article-parser", () => {
  describe("parseArticlesFromXml", () => {
    it("parses RSS feed correctly", async () => {
      const result = await parseArticlesFromXml(SAMPLE_RSS);

      expect(result.feed.title).toBe("Sample Feed");
      expect(result.articles.length).toBe(2);

      const firstArticle = result.articles[0]!;
      expect(firstArticle.flattened.title).toBe("First Article");
      expect(firstArticle.flattened.link).toBe("https://example.com/article1");
      expect(firstArticle.flattened.id).toBeDefined();
      expect(firstArticle.flattened.idHash).toBeDefined();
    });

    it("parses Atom feed correctly", async () => {
      const result = await parseArticlesFromXml(SAMPLE_ATOM);

      expect(result.feed.title).toBe("Atom Feed");
      expect(result.articles.length).toBe(1);

      const entry = result.articles[0]!;
      expect(entry.flattened.title).toBe("Atom Entry");
      expect(entry.flattened.id).toBeDefined();
    });

    it("throws InvalidFeedException for invalid XML", async () => {
      expect(parseArticlesFromXml("not valid xml")).rejects.toBeInstanceOf(
        InvalidFeedException
      );
    });

    it("throws InvalidFeedException for non-feed XML", async () => {
      const html = "<html><body>Not a feed</body></html>";
      expect(parseArticlesFromXml(html)).rejects.toBeInstanceOf(
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
      expect(firstArticle.flattened.pubdate).toBe("2024-01-01");
    });

    it("returns empty articles array for empty feed", async () => {
      const emptyFeed = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <title>Empty Feed</title>
          </channel>
        </rss>`;

      const result = await parseArticlesFromXml(emptyFeed);
      expect(result.articles.length).toBe(0);
      expect(result.feed.title).toBe("Empty Feed");
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
      expect(article.flattened["extracted::description::image1"]).toBe(
        "https://example.com/image.jpg"
      );
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

      expect(flattenedArticle.id).toBe(article.id);
      expect(flattenedArticle[`author${DL}name${DL}tag`]).toBe(
        article.author.name.tag
      );
    });

    it("flattens categories into a single string", () => {
      const article = {
        categories: ["cat1", "cat2", "cat3"],
      };

      const flattenedArticle = flattenArticle(article, {
        useParserRules: [],
      });

      expect(flattenedArticle["processed::categories"]).toBe("cat1,cat2,cat3");
    });

    it("flattens arrays", () => {
      const article = {
        id: "hello world",
        tags: ["tag1", "tag2"],
      };

      const flattenedArticle = flattenArticle(article, {
        useParserRules: [],
      });

      expect(flattenedArticle.id).toBe(article.id);
      expect(flattenedArticle[`tags${DL}0`]).toBe(article.tags[0]);
      expect(flattenedArticle[`tags${DL}1`]).toBe(article.tags[1]);
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

      expect(flattenedArticle.id).toBe(article.id);
      expect(flattenedArticle[`tags${DL}0${DL}name`]).toBe(
        article.tags[0].name
      );
      expect(flattenedArticle[`tags${DL}1${DL}name`]).toBe(
        article.tags[1].name
      );
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

      expect(flattenedArticle.id).toBe(article.id);
      expect(flattenedArticle[`tags${DL}0${DL}name`]).toBe(
        article.tags[0].name
      );
      expect(flattenedArticle[`tags${DL}0${DL}aliases${DL}0`]).toBe(
        article.tags[0].aliases[0]
      );
      expect(flattenedArticle[`tags${DL}0${DL}aliases${DL}1`]).toBe(
        article.tags[0].aliases[1]
      );
      expect(flattenedArticle[`tags${DL}1${DL}name`]).toBe(
        article.tags[1].name
      );
      expect(flattenedArticle[`tags${DL}1${DL}aliases${DL}0`]).toBe(
        article.tags[1].aliases[0]
      );
      expect(flattenedArticle[`tags${DL}1${DL}aliases${DL}1`]).toBe(
        article.tags[1].aliases[1]
      );
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

      expect(flattenedArticle.id).toBe(article.id);
      expect(flattenedArticle[`a${DL}${DL}b`]).toBe(article.a[`${DL}b`]);
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

        expect(flattenedArticle.id).toBe(article.id);
        expect(flattenedArticle.a).toBeUndefined();
        expect(flattenedArticle[`b${DL}c${DL}d`]).toBeUndefined();
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

      expect(flattenedArticle.id).toBe(article.id);
      expect(flattenedArticle.a).toBeUndefined();
      expect(flattenedArticle[`b${DL}c${DL}d${DL}e`]).toBeUndefined();
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

      expect(flattenedArticle.id).toBe(article.id);
      expect(flattenedArticle.a).toBeUndefined();
      expect(flattenedArticle[`b${DL}c${DL}d${DL}e`]).toBeUndefined();
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

      expect(flattenedArticle.id).toBe(article.id);
      expect(flattenedArticle.a).toBeUndefined();
      expect(flattenedArticle[`b${DL}c${DL}d${DL}e`]).toBeUndefined();
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

      expect(flattenedArticle.id).toBe(article.id);
      expect(flattenedArticle.a).toBe("1");
      expect(flattenedArticle[`b${DL}c${DL}d${DL}e`]).toBe("2");
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

      expect(flattenedArticle[`extracted::description::image1`]).toBe(
        "https://example.com/image.jpg"
      );
      expect(flattenedArticle[`extracted::description::image2`]).toBe(
        "https://example.com/image2.jpg"
      );
      expect(flattenedArticle[`extracted::summary::image1`]).toBe(
        "https://example.com/image3.jpg"
      );
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

      expect(flattenedArticle[`extracted::description::anchor1`]).toBe(
        "https://example.com"
      );
      expect(flattenedArticle[`extracted::summary::anchor1`]).toBe(
        "https://example.com"
      );
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

      expect(flattenedArticle.id).toBe(article.id);
      expect(flattenedArticle.a).toBe(
        dayjs(article.a).tz("UTC").locale("en").format()
      );
      expect(flattenedArticle[`b${DL}c${DL}d${DL}e`]).toBe(
        dayjs(article.b.c.d.e).tz("UTC").locale("en").format()
      );
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

      expect(flattenedArticle.id).toBe(article.id);
      expect(flattenedArticle.a).toBe(
        dayjs(article.a).tz("UTC").locale("en").format(dateFormat)
      );
      expect(flattenedArticle[`b${DL}c${DL}d${DL}e`]).toBe(
        dayjs(article.b.c.d.e).tz("UTC").locale("en").format(dateFormat)
      );
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

      expect(flattenedArticle.a).toMatch(/^\d+$/);
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

      expect(flattenedArticle.id).toBe(article.id);
      expect(flattenedArticle.a).toBe(
        dayjs(article.a).tz(dateTimezone).format()
      );
      expect(flattenedArticle[`b${DL}c${DL}d${DL}e`]).toBe(
        dayjs(article.b.c.d.e).tz(dateTimezone).format()
      );
    });
  });
});
