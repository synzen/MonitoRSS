/* eslint-disable max-len */
import { ArticleFormatterService } from "./article-formatter.service";

describe("ArticleFormatterService", () => {
  let service: ArticleFormatterService;

  beforeEach(() => {
    service = new ArticleFormatterService();
  });

  describe("formatValueForDiscord", () => {
    describe.skip("br", () => {
      // https://github.com/html-to-text/node-html-to-text/issues/280
      it("returns a new line", async () => {
        const value = `Text <br/> <br/> <div class="center-wrap"></div>`;

        const result = service.formatValueForDiscord(value);

        expect(result.value).toEqual("Text\n\n ");
      });
    });

    describe("a (anchors)", () => {
      it("returns the text with the link", async () => {
        const value = 'Say <a href="https://example.com">Hello World</a> to me';

        const result = service.formatValueForDiscord(value);

        expect(result.value).toEqual(
          "Say [Hello World](https://example.com) to me"
        );
      });
    });

    // it("does not return an anchor if the href is the same as the text", async () => {
    //   const value =
    //     'Say <a href="https://example.com">https://example.com</a> to me';

    //   const result = service.formatValueForDiscord(value);

    //   expect(result.value).toEqual("Say https://example.com to me");
    // });

    describe("custom placeholders", () => {
      it("adds the custom placeholder if the source key exists", async () => {
        const article = {
          flattened: {
            id: "1",
            title: "Hello World",
          },
          raw: {
            title: "Hello World",
          },
        };

        const result = await service.formatArticleForDiscord(article as never, {
          disableImageLinkPreviews: false,
          formatTables: false,
          stripImages: false,
          customPlaceholders: [
            {
              id: "test",
              referenceName: "test",
              sourcePlaceholder: "title",
              steps: [
                {
                  regexSearch: "Hello",
                  replacementString: "Goodbye",
                },
              ],
            },
          ],
        });

        expect(result.flattened["custom::test"]).toEqual("Goodbye World");
      });

      it("does not modify the source placeholder", async () => {
        const article = {
          flattened: {
            id: "1",
            title: "Hello World",
          },
          raw: {
            title: "Hello World",
          },
        };

        const result = await service.formatArticleForDiscord(article as never, {
          disableImageLinkPreviews: false,
          formatTables: false,
          stripImages: false,
          customPlaceholders: [
            {
              id: "test",
              referenceName: "test",
              sourcePlaceholder: "title",
              steps: [
                {
                  regexSearch: "Hello",
                  replacementString: "Goodbye",
                },
              ],
            },
          ],
        });

        expect(result.flattened["title"]).toEqual("Hello World");
      });

      it("replaces matches with an empty string if no replacement is specified", async () => {
        const article = {
          flattened: {
            id: "1",
            title: "Hello World",
          },
          raw: {
            title: "Hello World",
          },
        };

        const result = await service.formatArticleForDiscord(article as never, {
          disableImageLinkPreviews: false,
          formatTables: false,
          stripImages: false,
          customPlaceholders: [
            {
              id: "test",
              referenceName: "test",
              sourcePlaceholder: "title",
              steps: [
                {
                  regexSearch: "Hello",
                  replacementString: null,
                },
              ],
            },
          ],
        });

        expect(result.flattened["custom::test"]).toEqual("World");
      });

      it("replaces matches globally", async () => {
        const article = {
          flattened: {
            id: "1",
            title: "Hello World",
          },
          raw: {
            title: "Hello World",
          },
        };

        const result = await service.formatArticleForDiscord(article as never, {
          disableImageLinkPreviews: false,
          formatTables: false,
          stripImages: false,
          customPlaceholders: [
            {
              id: "test",
              referenceName: "test",
              sourcePlaceholder: "title",
              steps: [
                {
                  regexSearch: "l",
                  replacementString: "z",
                },
              ],
            },
          ],
        });

        expect(result.flattened["custom::test"]).toEqual("Hezzo Worzd");
      });

      it("replaces searches multi-line", async () => {
        const article = {
          flattened: {
            id: "1",
            title: `q hello<br />q<br />q<br />q world`,
          },
          raw: {
            title: "Hello World",
          },
        };

        const result = await service.formatArticleForDiscord(article as never, {
          disableImageLinkPreviews: false,
          formatTables: false,
          stripImages: false,
          customPlaceholders: [
            {
              id: "test",
              referenceName: "test",
              sourcePlaceholder: "title",
              steps: [
                {
                  regexSearch: "^q$",
                  replacementString: "replaced",
                },
              ],
            },
          ],
        });

        expect(result.flattened["custom::test"]).toEqual(
          "q hello\nreplaced\nreplaced\nq world"
        );
      });

      it("replaces searches case-insensitive", async () => {
        const article = {
          flattened: {
            id: "1",
            title: `hello HELLO world`,
          },
          raw: {
            title: "Hello World",
          },
        };

        const result = await service.formatArticleForDiscord(article as never, {
          disableImageLinkPreviews: false,
          formatTables: false,
          stripImages: false,
          customPlaceholders: [
            {
              id: "test",
              referenceName: "test",
              sourcePlaceholder: "title",
              steps: [
                {
                  regexSearch: "hello",
                  replacementString: "replaced",
                },
              ],
            },
          ],
        });

        expect(result.flattened["custom::test"]).toEqual(
          "replaced replaced world"
        );
      });

      it("works with multiple steps", async () => {
        const article = {
          flattened: {
            id: "1",
            title: `hello world`,
          },
          raw: {
            title: "Hello World",
          },
        };

        const result = await service.formatArticleForDiscord(article as never, {
          disableImageLinkPreviews: false,
          formatTables: false,
          stripImages: false,
          customPlaceholders: [
            {
              id: "test",
              referenceName: "test",
              sourcePlaceholder: "title",
              steps: [
                {
                  regexSearch: "hello",
                  replacementString: "goodbye",
                },
                {
                  regexSearch: "goodbye",
                  replacementString: "farewell",
                },
              ],
            },
          ],
        });

        expect(result.flattened["custom::test"]).toEqual("farewell world");
      });
    });

    describe("img", () => {
      it("returns the image link with no alt", async () => {
        const value = '<img src="https://example.com/image.png" />';

        const result = service.formatValueForDiscord(value);

        expect(result.value).toEqual("https://example.com/image.png");
      });

      it("returns the image link with an alt", async () => {
        const value =
          '<img src="https://example.com/image.png" alt="this should not show" />';

        const result = service.formatValueForDiscord(value);

        expect(result.value).toEqual("https://example.com/image.png");
      });

      it("excludes the image is strip image optin is true", async () => {
        const value = 'Hello <img src="https://example.com/image.png" /> World';

        const result = service.formatValueForDiscord(value, {
          stripImages: true,
          formatTables: false,
          disableImageLinkPreviews: false,
          customPlaceholders: [],
        });

        expect(result.value).toEqual("Hello World");
      });

      it("wraps links with < and > when disable image link previews is true", async () => {
        const value =
          'Hello <img src="https://example.com/image.png" /> World <img src="https://example.com/image2.png" />';

        const result = service.formatValueForDiscord(value, {
          stripImages: false,
          formatTables: false,
          disableImageLinkPreviews: true,
          customPlaceholders: [],
        });

        expect(result.value).toEqual(
          "Hello <https://example.com/image.png> World <https://example.com/image2.png>"
        );
      });
    });

    describe("heading", () => {
      it.each(["h1", "h2", "h3", "h4", "h5", "h6"])(
        `returns the text bolded for %s`,
        async (elem) => {
          const result = service.formatValueForDiscord(
            `<${elem}>hello world</${elem}>`
          );

          expect(result.value).toEqual("**hello world**");
        }
      );
    });

    describe("strong", () => {
      it("returns the text bolded", async () => {
        const value = "<strong>hello world</strong>";

        const result = service.formatValueForDiscord(value);

        expect(result.value).toEqual("**hello world**");
      });

      it("does not add new newlines", () => {
        const value = `<p>First <strong>Before</strong>:</p>`;
        service = new ArticleFormatterService();

        const result = service.formatValueForDiscord(value);

        expect(result.value).toEqual("First **Before**:");
      });
    });

    describe("code", () => {
      it("returns the text in a inline code block", async () => {
        const value = "<code>hello world</code>";

        const result = service.formatValueForDiscord(value);

        expect(result.value).toEqual("`hello world`");
      });
    });

    describe("pre", () => {
      it("returns the text in a code block", async () => {
        const value = "<pre>hello world</pre>";

        const result = service.formatValueForDiscord(value);

        expect(result.value).toEqual("```hello world```");
      });
    });

    describe("em", () => {
      it("returns the text italicized", async () => {
        const value = "<em>hello world</em>";

        const result = service.formatValueForDiscord(value);

        expect(result.value).toEqual("*hello world*");
      });
    });

    describe("u", () => {
      it("returns the text underlined", async () => {
        const value = "<u>hello world</u>";

        const result = service.formatValueForDiscord(value);

        expect(result.value).toEqual("__hello world__");
      });
    });

    describe("table", () => {
      it("returns tables correctly with table formatting", async () => {
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

        const result = service.formatValueForDiscord(value, {
          formatTables: true,
          stripImages: false,
          disableImageLinkPreviews: false,
          customPlaceholders: [],
        });

        expect(result.value).toEqual(
          `
\`\`\`

COMPANY                      CONTACT           COUNTRY
Alfreds Futterkiste          Maria Anders      Germany
Centro comercial Moctezuma   Francisco Chang   Mexico

\`\`\``.trim()
        );
      });
    });

    describe("unordered list", () => {
      it("overrides the prefix", async () => {
        const result = service.formatValueForDiscord(
          "<ul><li>1</li><li>2</li></ul>"
        );

        expect(result.value).toEqual("* 1\n* 2");
      });
    });

    it("works", async () => {
      const val = `
    <table>
      <tr>
        <td>
          <a href="https://www.reddit.com/r/FORTnITE/comments/10i5m9z/mission_alerts_1200am_utc_22jan2023/">
            <img src="https://image.com" alt="Mission Alerts 12:00AM UTC 22/Jan/2023" title="Mission Alerts 12:00AM UTC 22/Jan/2023" />
          </a>
        </td>
        <td> &#32; submitted by &#32; <a href="https://www.reddit.com/user/FortniteStatusBot"> /u/FortniteStatusBot </a> &#32; to &#32; <a href="https://www.reddit.com/r/FORTnITE/"> r/FORTnITE </a>
          <br />
          <span>
            <a href="https://seebot.dev/images/archive/missions/22_Jan_2023.png?300">[link]</a>
          </span> &#32; <span>
            <a href="https://www.reddit.com/r/FORTnITE/comments/10i5m9z/mission_alerts_1200am_utc_22jan2023/">[comments]</a>
          </span>
        </td>
      </tr>
    </table>`;

      const result = service.formatValueForDiscord(val);

      expect(result.value).toEqual(
        `
[ https://image.com ](https://www.reddit.com/r/FORTnITE/comments/10i5m9z/mission_alerts_1200am_utc_22jan2023/) submitted by [ /u/FortniteStatusBot ](https://www.reddit.com/user/FortniteStatusBot) to [ r/FORTnITE ](https://www.reddit.com/r/FORTnITE/)
[[link]](https://seebot.dev/images/archive/missions/22_Jan_2023.png?300) [[comments]](https://www.reddit.com/r/FORTnITE/comments/10i5m9z/mission_alerts_1200am_utc_22jan2023/)
`.trim()
      );
    });

    describe("nested paragraphs", () => {
      it("works", () => {
        const val = `
        <p>hello <strong>world 😀</strong> <p>another example</p></p>
        `;

        const result = service.formatValueForDiscord(val);

        expect(result.value).toEqual("hello **world 😀** \n\nanother example");
      });
    });
  });

  describe("applySplit", () => {
    it("does not apply split if split is not enabled", () => {
      const result = service.applySplit("hello world", {
        isEnabled: false,
      });

      expect(result).toEqual(["hello world"]);
    });

    it("applies split with a low limit", () => {
      const result = service.applySplit("hello world", {
        limit: 4,
        isEnabled: true,
        appendChar: "",
        prependChar: "",
      });

      expect(result).toEqual(["hell", "o", "worl", "d"]);
    });

    it("returns an empty string if input text is empty", async () => {
      const result = await service.applySplit("");

      expect(result).toEqual([""]);
    });

    it("applies split with a high limit", () => {
      const result = service.applySplit("hello world", {
        limit: 100,
        isEnabled: true,
        appendChar: "",
        prependChar: "",
      });

      expect(result).toEqual(["hello world"]);
    });

    it("does not add append char if there was nothing to split on", () => {
      const result = service.applySplit("hello world", {
        limit: 100,
        isEnabled: true,
        appendChar: "!",
        prependChar: "",
      });

      expect(result).toEqual(["hello world"]);
    });

    it("does not add prepend char if there was nothing to split on", () => {
      const result = service.applySplit("hello world", {
        limit: 100,
        isEnabled: true,
        appendChar: "",
        prependChar: "!",
      });

      expect(result).toEqual(["hello world"]);
    });

    it("does not add append and prepend char if there was nothing to split on", () => {
      const result = service.applySplit("hello world", {
        limit: 100,
        isEnabled: true,
        appendChar: "!",
        prependChar: "!",
      });

      expect(result).toEqual(["hello world"]);
    });

    it("applies split with a high limit and append and prepend char and multiple lines", () => {
      const result = service.applySplit("hello world\nhello world", {
        limit: 16,
        isEnabled: true,
        appendChar: "!",
        prependChar: "!",
      });

      expect(result).toEqual(["!hello world", "hello world!"]);
    });

    it("applies split with a high limit and append and prepend char and multiple lines and a long word", () => {
      const result = service.applySplit(
        "hello world\nhello world\nsupercalifragilisticexpialidocious",
        {
          limit: 16,
          isEnabled: true,
          appendChar: "!",
          prependChar: "!",
        }
      );

      expect(result).toEqual([
        "!hello world",
        "hello world",
        "supercalifragi",
        "listicexpialid",
        "ocious!",
      ]);
    });

    it("applies split with a high limit and append and prepend char and multiple lines and a long word and a long word at the end", () => {
      const result = service.applySplit(
        "hello world\nhello world\nsupercalifragilisticexpialidocious\nsupercalifragilisticexpialidocious",
        {
          limit: 16,
          isEnabled: true,
          appendChar: "!",
          prependChar: "!",
        }
      );

      expect(result).toEqual([
        "!hello world",
        "hello world",
        "supercalifragi",
        "listicexpialid",
        "ocious",
        "supercalifragi",
        "listicexpialid",
        "ocious!",
      ]);
    });

    it("does not create create duplicate split chars with multiple new lines", () => {
      const result = service.applySplit(
        "hello world.\n\n\nhello world.\n\n\n",
        {
          limit: 5,
          isEnabled: true,
        }
      );

      expect(result).toEqual(["hello", "world", ".", "hello", "world", "."]);
    });

    it("should preserve double new lines when possible", () => {
      const result = service.applySplit(`a\n\na\n\nb`.trim(), {
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

      const result = service.applySplit(str, {
        limit,
        isEnabled: true,
        appendChar,
        prependChar,
      });

      expect(result[0]).toEqual(`${prependChar}h`);
      result.slice(1, result.length - 1).map((r) => {
        // The new input limit is assumed to be 4
        expect(r.length).toEqual(1);
      });
      expect(result[result.length - 1]).toEqual(`d${appendChar}`);
    });

    it("splits on periods when available", () => {
      const str = `hello. world.`;
      const limit = 7;

      const result = service.applySplit(str, {
        limit,
        isEnabled: true,
      });

      expect(result).toEqual(["hello.", "world."]);
    });

    it("splits on question marks when available", () => {
      const str = `hello? world?`;
      const limit = 7;

      const result = service.applySplit(str, {
        limit,
        isEnabled: true,
      });

      expect(result).toEqual(["hello?", "world?"]);
    });

    it("splits on exclamation marks when available", () => {
      const str = `hello! world!`;
      const limit = 7;

      const result = service.applySplit(str, {
        limit,
        isEnabled: true,
      });

      expect(result).toEqual(["hello!", "world!"]);
    });

    it("splits on all punctuation when available", () => {
      const str = `hello! world? fate. codinghere!`;
      const limit = 7;

      const result = service.applySplit(str, {
        limit,
        isEnabled: true,
      });

      expect(result).toEqual(["hello!", "world?", "fate.", "codingh", "ere!"]);
    });
  });
});
