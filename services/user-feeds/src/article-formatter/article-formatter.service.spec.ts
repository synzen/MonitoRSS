/* eslint-disable max-len */
import { ArticleFormatterService } from "./article-formatter.service";

describe("ArticleFormatterService", () => {
  let service: ArticleFormatterService;

  beforeEach(() => {
    service = new ArticleFormatterService();
  });

  describe("img", () => {
    it("returns the image link", async () => {
      const value = '<img src="https://example.com/image.png" />';

      const result = await service.formatValueForDiscord(value);

      expect(result).toEqual("https://example.com/image.png");
    });

    it("excludes the image is strip image optin is true", async () => {
      const value = 'Hello <img src="https://example.com/image.png" /> World';

      const result = await service.formatValueForDiscord(value, {
        stripImages: true,
      });

      expect(result).toEqual("Hello World");
    });
  });

  describe("heading", () => {
    it.each(["h1", "h2", "h3", "h4", "h5", "h6"])(
      `returns the text bolded for %s`,
      async (elem) => {
        const result = await service.formatValueForDiscord(
          `<${elem}>hello world</${elem}>`
        );

        expect(result).toEqual("**hello world**");
      }
    );
  });

  describe("strong", () => {
    it("returns the text bolded", async () => {
      const value = "<strong>hello world</strong>";

      const result = await service.formatValueForDiscord(value);

      expect(result).toEqual("**hello world**");
    });
  });

  describe("em", () => {
    it("returns the text italicized", async () => {
      const value = "<em>hello world</em>";

      const result = await service.formatValueForDiscord(value);

      expect(result).toEqual("*hello world*");
    });
  });

  describe("u", () => {
    it("returns the text underlined", async () => {
      const value = "<u>hello world</u>";

      const result = await service.formatValueForDiscord(value);

      expect(result).toEqual("__hello world__");
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

      const result = await service.formatValueForDiscord(value, {
        formatTables: true,
      });

      expect(result).toEqual(
        `
COMPANY                      CONTACT           COUNTRY
Alfreds Futterkiste          Maria Anders      Germany
Centro comercial Moctezuma   Francisco Chang   Mexico`.trim()
      );
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

    const result = await service.formatValueForDiscord(val);

    expect(result).toEqual(
      `
Mission Alerts 12:00AM UTC 22/Jan/2023 https://image.com submitted by /u/FortniteStatusBot to r/FORTnITE
[link] [comments]
`.trim()
    );
  });
});
