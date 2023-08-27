import { URL } from "url";
import { PostProcessParserRule } from "../../article-parser/constants";

export const getParserRules = ({ url }: { url: string }) => {
  const rules: PostProcessParserRule[] = [];
  const parsedUrl = new URL(url);

  if (parsedUrl.host === "www.reddit.com") {
    rules.push(PostProcessParserRule.RedditCommentLink);
  }

  return rules;
};
