import { render } from "@testing-library/react";
import dayjs from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat";
// @ts-ignore - markdown.jsx is an untyped legacy module
import { parseAllowLinks } from "./markdown";

dayjs.extend(localizedFormat);

const UNIX = 1783151708;

const renderContent = (content: string, inline = true) =>
  render(<div className="markup">{parseAllowLinks(content, inline)}</div>);

describe("markdown Discord timestamps", () => {
  it("renders <t:UNIX> as a localized short date/time", () => {
    const { container } = renderContent(`<t:${UNIX}>`);
    const el = container.querySelector(".discord-timestamp");

    expect(el).not.toBeNull();
    expect(el?.textContent).toEqual(dayjs.unix(UNIX).format("LLL"));
    expect(container.textContent).not.toContain(`<t:${UNIX}>`);
  });

  it("honors the explicit style suffix", () => {
    const { container } = renderContent(`<t:${UNIX}:D>`);
    const el = container.querySelector(".discord-timestamp");

    expect(el?.textContent).toEqual(dayjs.unix(UNIX).format("LL"));
  });

  it("renders a timestamp surrounded by text without breaking to a new line", () => {
    const { container } = renderContent(`before <t:${UNIX}> after`);

    expect(container.querySelector(".discord-timestamp")).not.toBeNull();
    // No blockquote, heading, or paragraph break introduced by the timestamp
    expect(container.querySelector(".markdown-blockquote")).toBeNull();
    expect(container.textContent).toContain("before ");
    expect(container.textContent).toContain(" after");
  });

  it("leaves an invalid style as raw text rather than a timestamp", () => {
    const { container } = renderContent(`<t:${UNIX}:X>`);

    expect(container.querySelector(".discord-timestamp")).toBeNull();
    expect(container.textContent).toContain(`<t:${UNIX}:X`);
  });

  // Reproduces the reported template: heading + bold + blockquote followed by a
  // timestamp on its own line. The timestamp must render formatted and must not be
  // absorbed into the preceding blockquote. Parsed with inline=false to match the
  // real V2 TextDisplay/Section path (DiscordMessageDisplay) that renders headings.
  it("renders a timestamp on the line after a blockquote in the reported template", () => {
    const content = [
      "### [Some Title](https://example.com/article)",
      "**Some Author**",
      "> Some quoted output",
      `<t:${UNIX}>`,
    ].join("\n");

    const { container } = renderContent(content, false);

    // Heading, bold, and blockquote all render.
    expect(container.querySelector(".markdown-heading-3")).not.toBeNull();
    expect(container.querySelector("strong")?.textContent).toEqual("Some Author");
    const blockquote = container.querySelector(".markdown-blockquote");
    expect(blockquote?.textContent).toEqual("Some quoted output");

    // The timestamp renders formatted, outside the blockquote, not as raw text.
    const timestamp = container.querySelector(".discord-timestamp");
    expect(timestamp?.textContent).toEqual(dayjs.unix(UNIX).format("LLL"));
    expect(blockquote?.contains(timestamp)).toBe(false);
    expect(container.textContent).not.toContain(`<t:${UNIX}>`);
  });
});
