import FeedParser from "feedparser";
import { FlattenedArticle } from "./flattened-article.type";

export interface Article {
  flattened: FlattenedArticle;
  raw: FeedParser.Item;
}
