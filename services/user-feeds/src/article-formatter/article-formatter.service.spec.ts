/* eslint-disable max-len */
import { ArticleFormatterService } from "./article-formatter.service";

describe("ArticleFormatterService", () => {
  let service: ArticleFormatterService;

  beforeEach(() => {
    service = new ArticleFormatterService();
  });

  describe("formatValueForDiscord", () => {
    describe("img", () => {
      it("returns the image link", async () => {
        const value = '<img src="https://example.com/image.png" />';

        const result = service.formatValueForDiscord(value);

        expect(result.value).toEqual("https://example.com/image.png");
      });

      it("excludes the image is strip image optin is true", async () => {
        const value = 'Hello <img src="https://example.com/image.png" /> World';

        const result = service.formatValueForDiscord(value, {
          stripImages: true,
          formatTables: false,
        });

        expect(result.value).toEqual("Hello World");
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

        expect(result.value).toEqual("• 1\n• 2");
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
Mission Alerts 12:00AM UTC 22/Jan/2023 https://image.com submitted by /u/FortniteStatusBot to r/FORTnITE
[link] [comments]
`.trim()
      );
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

    it("applies split with a high limit and append char", () => {
      const result = service.applySplit("hello world", {
        limit: 100,
        isEnabled: true,
        appendChar: "!",
        prependChar: "",
      });

      expect(result).toEqual(["hello world!"]);
    });

    it("applies split with a high limit and prepend char", () => {
      const result = service.applySplit("hello world", {
        limit: 100,
        isEnabled: true,
        appendChar: "",
        prependChar: "!",
      });

      expect(result).toEqual(["!hello world"]);
    });

    it("applies split with a high limit and append and prepend char", () => {
      const result = service.applySplit("hello world", {
        limit: 100,
        isEnabled: true,
        appendChar: "!",
        prependChar: "!",
      });

      expect(result).toEqual(["!hello world!"]);
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
  });
});
