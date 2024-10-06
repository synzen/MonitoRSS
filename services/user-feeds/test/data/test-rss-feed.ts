import { XMLBuilder, XMLParser } from "fast-xml-parser";

interface TestArticle {
  guid: string;
  [key: string]: string;
}

export const DEFAULT_TEST_ARTICLES: Array<TestArticle> = [
  {
    guid: "initial",
    title: "initial title",
  },
];

const getTestRssFeed = (articles?: Array<TestArticle>) => {
  const parser = new XMLParser();
  const parsed: {
    rss: { channel: { item: Array<TestArticle> } };
  } = parser.parse(`
     <?xml version="1.0" encoding="UTF-8" ?>
     <rss version="2.0"><channel><title>Feed title</title></channel>
     </rss>
    `);
  parsed.rss.channel.item = [...DEFAULT_TEST_ARTICLES, ...(articles || [])];

  const builder = new XMLBuilder();

  const newFeedText = builder.build(parsed);

  return newFeedText;
};

export default getTestRssFeed;
