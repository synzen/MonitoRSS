/* eslint-disable max-len */
// @ts-ignore
import Article from "./Article";

describe("Unit::structs/Article", function () {
  const baseArticle = {
    meta: {},
  };
  const feedData = {
    feed: {},
  };
  const defaultOptions = {
    dateFallback: false,
    timeFallback: false,
    dateFormat: "ddd, D MMMM YYYY, h:mm A z",
    formatTables: false,
    imgLinksExistence: true,
    imgPreviews: true,
    timezone: "UTC",
  };
  let article: Article;

  beforeEach(() => {
    article = new Article(baseArticle, feedData, defaultOptions);
  });

  describe("testFilters", function () {
    it("passes with no filters", function () {
      article.fullTitle = "my sentence is this";
      const filters = {};
      const returned = article.testFilters(filters);
      expect(returned.passed).toEqual(true);
    });
    it("works with regular filters", function () {
      article.fullTitle = "my sentence is this";
      const filters = {
        title: ["foo", "sentence"],
      };
      const returned = article.testFilters(filters);
      expect(returned.passed).toEqual(true);
    });
    it("blocks when regular filters are not found", function () {
      article.fullTitle = "my cahones";
      const filters = {
        title: ["foo", "sentence"],
      };
      const returned = article.testFilters(filters);
      expect(returned.passed).toEqual(false);
    });
    it("works with negated filters", function () {
      article.fullTitle = "my sentence is this";
      const filters = {
        title: ["!sentence"],
      };
      const returned = article.testFilters(filters);
      expect(returned.passed).toEqual(false);
    });
    it("passes when negated filters are not found", function () {
      article.fullTitle = "my cajones is this";
      const filters = {
        title: ["!sentence"],
      };
      const returned = article.testFilters(filters);
      expect(returned.passed).toEqual(true);
    });
    it("works with broad filters", function () {
      article.fullTitle = "my sentence is this";
      const filters = {
        title: ["~ence"],
      };
      const returned = article.testFilters(filters);
      expect(returned.passed).toEqual(true);
    });
    it("blocks when broad filters are not found", function () {
      article.fullTitle = "is this";
      const filters = {
        title: ["~ence"],
      };
      const returned = article.testFilters(filters);
      expect(returned.passed).toEqual(false);
    });
    it("works with regular and negated filters", function () {
      article.fullTitle = "my sentence is this";
      const filters = {
        title: ["!sentence", "my"],
      };
      const returned = article.testFilters(filters);
      expect(returned.passed).toEqual(false);
    });
    it("works with broad and negated filters", function () {
      article.fullTitle = "my sentence is this";
      const filters = {
        title: ["!sentence", "~ence"],
      };
      const returned = article.testFilters(filters);
      expect(returned.passed).toEqual(false);
    });
    it("all types works together", function () {
      const filters = {
        title: [
          "(free/100% off)",
          "(free / 100% off)",
          "100% off",
          "$0.99",
          "~100%",
          "!~itch.io",
          "!boogeyman",
        ],
      };
      article.fullTitle =
        "[Steam] Key x Sekai Project Publisher Weekend (Planetarian $4.49/55%, Re;Lord $6.99/30%," +
        " Clannad Complete $34.40/60%, Maitetsu $8.99/40% and more)";
      const returned = article.testFilters(filters);
      expect(returned.passed).toEqual(false);
    });
    it("blocks for non-existent article properties", function () {
      const filters = {
        Title: ["Blah"],
      };
      article.title = "Blah george";
      const returned = article.testFilters(filters);
      expect(returned.passed).toEqual(false);
    });
    it("works with filters across multiple categories", function () {
      const filters = {
        title: ["Blah"],
        description: ["Boh"],
      };
      article.title = "Blah george";
      article.description = "hoder";
      const returned = article.testFilters(filters);
      expect(returned.passed).toEqual(true);
    });
    it("blocks when one filter blocks with filters in multiple categories", function () {
      const filters = {
        title: ["Blah"],
        description: ["!Boh"],
        author: ["Bang"],
      };
      article.title = "Blah Blahs";
      article.description = "Ban Boh";
      article.author = "Bang Bang";
      const returned = article.testFilters(filters);
      expect(returned.passed).toEqual(false);
    });
    it("blocks when using broad filters and negated filters in different categories", function () {
      const filters = {
        title: ["~campaig"],
        guid: ["!60097a6bf64cf135e3323184"],
      };
      article.title = "Sirius and Utopia Compete to Host Galactic Summit";
      article.guid = "600accd53eb598007a0385f8";
      const returned = article.testFilters(filters);
      expect(returned.passed).toEqual(false);
    });
    it("passes with negated and regular in one category with regular in another, and the other matches", function () {
      const filters = {
        title: ["!software", "srfdhetgfj"],
        author: ["huntermc"],
      };
      article.title = "[UPDATE] Hunter's Harem [v0.4.3.2a]";
      article.author = "huntermc";
      const returned = article.testFilters(filters);
      expect(returned.passed).toEqual(true);
    });
    it("passes for negated filters if the property does not exist", () => {
      const filters = {
        title: ["!holla-go"],
      };
      article.description = "unrelated";
      const returned = article.testFilters(filters);
      expect(returned.passed).toEqual(true);
    });
    it("passes properly for negated filters on non-existent property and regular filters on existent property", () => {
      const filters = {
        title: ["!holla-go"],
        description: ["unrelated"],
      };
      article.description = "unrelated";
      const returned = article.testFilters(filters);
      expect(returned.passed).toEqual(true);
    });
    it("blocks properly for negated filters on non-existent property and regular filters on existent property", () => {
      const filters = {
        title: ["!holla-go"],
        description: ["!unrelated"],
      };
      article.description = "unrelated";
      const returned = article.testFilters(filters);
      expect(returned.passed).toEqual(false);
    });
  });

  describe("toJSON", () => {
    it("returns the formatted json", () => {
      const json = article.toJSON();
      expect(json).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          title: expect.any(String),
          placeholders: expect.objectContaining({
            public: expect.any(Array),
            private: expect.any(Array),
            regex: expect.any(Array),
            raw: expect.any(Array),
          }),
        })
      );
    });
  });
});
