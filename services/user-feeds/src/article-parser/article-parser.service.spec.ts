import dayjs from "dayjs";
import { ARTICLE_FIELD_DELIMITER } from "../articles/constants";
import { ArticleParserService } from "./article-parser.service";
import { describe, beforeEach, it } from "node:test";
import assert from "assert";

const DL = ARTICLE_FIELD_DELIMITER;

describe("ArticleParserService", () => {
  let service: ArticleParserService;

  beforeEach(() => {
    service = new ArticleParserService({} as never);
  });

  describe("flatten", () => {
    it("flattens nested objects", async () => {
      const article = {
        id: "hello world",
        author: {
          name: {
            tag: "tag",
          },
        },
      };

      const flattenedArticle = await service.flatten(article, {
        useParserRules: [],
      });

      assert.strictEqual(flattenedArticle.flattened.id, article.id);
      assert.strictEqual(
        flattenedArticle.flattened[`author${DL}name${DL}tag`],
        article.author.name.tag
      );
    });

    it("flattens categories into a single string", async () => {
      const article = {
        categories: ["cat1", "cat2", "cat3"],
      };

      const flattenedArticle = await service.flatten(article, {
        useParserRules: [],
      });

      assert.strictEqual(
        flattenedArticle.flattened["processed::categories"],
        "cat1,cat2,cat3"
      );
    });

    it("flattens arrays", async () => {
      const article = {
        id: "hello world",
        tags: ["tag1", "tag2"],
      };

      const flattenedArticle = await service.flatten(article, {
        useParserRules: [],
      });

      assert.strictEqual(flattenedArticle.flattened.id, article.id);
      assert.strictEqual(
        flattenedArticle.flattened[`tags${DL}0`],
        article.tags[0]
      );
      assert.strictEqual(
        flattenedArticle.flattened[`tags${DL}1`],
        article.tags[1]
      );
    });

    it("flattens arrays of objects", async () => {
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

      const flattenedArticle = await service.flatten(article, {
        useParserRules: [],
      });

      assert.strictEqual(flattenedArticle.flattened.id, article.id);
      assert.strictEqual(
        flattenedArticle.flattened[`tags${DL}0${DL}name`],
        article.tags[0].name
      );
      assert.strictEqual(
        flattenedArticle.flattened[`tags${DL}1${DL}name`],
        article.tags[1].name
      );
    });

    it("flattens arrays of objects with arrays", async () => {
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

      const flattenedArticle = await service.flatten(article, {
        useParserRules: [],
      });

      assert.strictEqual(flattenedArticle.flattened.id, article.id);
      assert.strictEqual(
        flattenedArticle.flattened[`tags${DL}0${DL}name`],
        article.tags[0].name
      );
      assert.strictEqual(
        flattenedArticle.flattened[`tags${DL}0${DL}aliases${DL}0`],
        article.tags[0].aliases[0]
      );
      assert.strictEqual(
        flattenedArticle.flattened[`tags${DL}0${DL}aliases${DL}1`],
        article.tags[0].aliases[1]
      );
      assert.strictEqual(
        flattenedArticle.flattened[`tags${DL}1${DL}name`],
        article.tags[1].name
      );
      assert.strictEqual(
        flattenedArticle.flattened[`tags${DL}1${DL}aliases${DL}0`],
        article.tags[1].aliases[0]
      );
      assert.strictEqual(
        flattenedArticle.flattened[`tags${DL}1${DL}aliases${DL}1`],
        article.tags[1].aliases[1]
      );
    });

    it("handles keys with the delimiter in it", async () => {
      const article = {
        id: "hello world",
        a: {
          [`${DL}b`]: "c",
        },
      };

      const flattenedArticle = await service.flatten(article, {
        useParserRules: [],
      });

      assert.strictEqual(flattenedArticle.flattened.id, article.id);
      assert.strictEqual(
        flattenedArticle.flattened[`a${DL}${DL}b`],
        article.a[`${DL}b`]
      );
    });

    [
      { val: null, desc: "null" },
      { val: undefined, desc: "undefined" },
      { val: "", desc: "empty string" },
      { val: " ", desc: "whitespace" },
    ].forEach(({ val, desc }) => {
      it(`excludes ${desc} values from the final object`, async () => {
        const article = {
          id: "hello world",
          a: val,
          b: {
            c: {
              d: val,
            },
          },
        };

        const flattenedArticle = await service.flatten(article, {
          useParserRules: [],
        });

        assert.strictEqual(flattenedArticle.flattened.id, article.id);
        assert.strictEqual(flattenedArticle.flattened.a, undefined);
        assert.strictEqual(
          flattenedArticle.flattened[`b${DL}c${DL}d`],
          undefined
        );
      });
    });

    it("omits null values", async () => {
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

      const flattenedArticle = await service.flatten(article, {
        useParserRules: [],
      });

      assert.strictEqual(flattenedArticle.flattened.id, article.id);
      assert.strictEqual(flattenedArticle.flattened.a, undefined);
      assert.strictEqual(
        flattenedArticle.flattened[`b${DL}c${DL}d${DL}e`],
        undefined
      );
    });

    it("removes empty objects", async () => {
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

      const flattenedArticle = await service.flatten(article, {
        useParserRules: [],
      });

      assert.strictEqual(flattenedArticle.flattened.id, article.id);
      assert.strictEqual(flattenedArticle.flattened.a, undefined);
      assert.strictEqual(
        flattenedArticle.flattened[`b${DL}c${DL}d${DL}e`],
        undefined
      );
    });

    it("removes empty arrays", async () => {
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

      const flattenedArticle = await service.flatten(article, {
        useParserRules: [],
      });

      assert.strictEqual(flattenedArticle.flattened.id, article.id);
      assert.strictEqual(flattenedArticle.flattened.a, undefined);
      assert.strictEqual(
        flattenedArticle.flattened[`b${DL}c${DL}d${DL}e`],
        undefined
      );
    });

    it("converts numbers to strings", async () => {
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

      const flattenedArticle = await service.flatten(article, {
        useParserRules: [],
      });

      assert.strictEqual(flattenedArticle.flattened.id, article.id);
      assert.strictEqual(flattenedArticle.flattened.a, "1");
      assert.strictEqual(
        flattenedArticle.flattened[`b${DL}c${DL}d${DL}e`],
        "2"
      );
    });

    it("extracts images", async () => {
      const article = {
        id: "123",
        description:
          'hello <img src="https://example.com/image.jpg" />' +
          ' world <img src="https://example.com/image2.jpg" />',
        summary: "hello world <img src='https://example.com/image3.jpg' />",
      };

      const flattenedArticle = await service.flatten(article, {
        useParserRules: [],
      });

      assert.strictEqual(
        flattenedArticle.flattened[`extracted::description::image1`],
        "https://example.com/image.jpg"
      );
      assert.strictEqual(
        flattenedArticle.flattened[`extracted::description::image2`],
        "https://example.com/image2.jpg"
      );
      assert.strictEqual(
        flattenedArticle.flattened[`extracted::summary::image1`],
        "https://example.com/image3.jpg"
      );
    });

    it("extracts anchors", async () => {
      const article = {
        id: "123",
        description: 'hello <a href="https://example.com">world</a>',
        summary: 'hello world <a href="https://example.com">world</a>',
      };

      const flattenedArticle = await service.flatten(article, {
        useParserRules: [],
      });

      assert.strictEqual(
        flattenedArticle.flattened[`extracted::description::anchor1`],
        "https://example.com"
      );
      assert.strictEqual(
        flattenedArticle.flattened[`extracted::summary::anchor1`],
        "https://example.com"
      );
    });
  });

  describe("dates", () => {
    it("converts dates to ISO strings", async () => {
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

      const flattenedArticle = await service.flatten(article, {
        useParserRules: [],
      });

      assert.strictEqual(flattenedArticle.flattened.id, article.id);
      assert.strictEqual(
        flattenedArticle.flattened.a,
        dayjs(article.a).tz("UTC").locale("en").format()
      );
      assert.strictEqual(
        flattenedArticle.flattened[`b${DL}c${DL}d${DL}e`],
        dayjs(article.b.c.d.e).tz("UTC").locale("en").format()
      );
    });

    it("converts dates to ISO strings with a custom date format", async () => {
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

      const flattenedArticle = await service.flatten(article, {
        formatOptions: {
          dateFormat,
          dateTimezone: undefined,
          disableImageLinkPreviews: false,
          dateLocale: undefined,
        },
        useParserRules: [],
      });

      assert.strictEqual(flattenedArticle.flattened.id, article.id);
      assert.strictEqual(
        flattenedArticle.flattened.a,
        dayjs(article.a).tz("UTC").locale("en").format(dateFormat)
      );
      assert.strictEqual(
        flattenedArticle.flattened[`b${DL}c${DL}d${DL}e`],
        dayjs(article.b.c.d.e).tz("UTC").locale("en").format(dateFormat)
      );
    });

    it("converts dates to ISO strings with a advanced custom date formats", async () => {
      const date = new Date(2020, 1, 1);
      const article = {
        id: "hello world",
        a: date,
      };

      const dateFormat = "x";

      const flattenedArticle = await service.flatten(article, {
        formatOptions: {
          dateFormat,
          dateTimezone: undefined,
          disableImageLinkPreviews: false,
          dateLocale: undefined,
        },
        useParserRules: [],
      });

      assert.match(flattenedArticle.flattened.a, /^\d+$/);
    });

    it("works with custom timezones", async () => {
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

      const flattenedArticle = await service.flatten(article, {
        formatOptions: {
          dateFormat: undefined,
          dateTimezone,
          disableImageLinkPreviews: false,
          dateLocale: undefined,
        },
        useParserRules: [],
      });

      assert.strictEqual(flattenedArticle.flattened.id, article.id);
      assert.strictEqual(
        flattenedArticle.flattened.a,
        dayjs(article.a).tz(dateTimezone).format()
      );
      assert.strictEqual(
        flattenedArticle.flattened[`b${DL}c${DL}d${DL}e`],
        dayjs(article.b.c.d.e).tz(dateTimezone).format()
      );
    });
  });
});
