import { PostProcessParserRule } from "../../article-parser/constants";
import { getParserRules } from "./get-parser-rules";

describe("getParserRulesFromUrl", () => {
  it("returns the correct parser rule for reddit", () => {
    const result = getParserRules({ url: "https://www.reddit.com" });

    expect(result).toEqual(
      expect.arrayContaining([PostProcessParserRule.RedditCommentLink])
    );
  });
});
