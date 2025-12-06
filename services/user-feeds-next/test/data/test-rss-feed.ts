import { XMLBuilder, XMLParser } from "fast-xml-parser";

interface TestArticle {
  guid: string;
  title?: string;
  [key: string]: string | undefined;
}

export const DEFAULT_TEST_ARTICLES: [TestArticle, ...TestArticle[]] = [
  {
    guid: "initial",
    title: "initial title",
  },
];

/**
 * Generate a test RSS feed with the given articles.
 *
 * @param articles - Optional array of articles to add to the feed
 * @param replace - If true, replaces the default articles; if false, appends to defaults
 * @returns RSS XML string
 */
const getTestRssFeed = (
  articles?: Array<TestArticle>,
  replace?: boolean
): string => {
  const parser = new XMLParser();
  const parsed: {
    rss: { channel: { item: Array<TestArticle> } };
  } = parser.parse(`
     <?xml version="1.0" encoding="UTF-8" ?>
     <rss version="2.0"><channel><title>Feed title</title></channel>
     </rss>
    `);

  parsed.rss.channel.item = replace
    ? articles || DEFAULT_TEST_ARTICLES
    : [...DEFAULT_TEST_ARTICLES, ...(articles || [])];

  const builder = new XMLBuilder();

  const newFeedText = builder.build(parsed);

  return newFeedText;
};

export default getTestRssFeed;
