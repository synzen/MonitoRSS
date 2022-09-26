import FeedParser from "feedparser";

export interface FeedData {
  articleList: FeedParser.Item[];
  idType?: string;
}
