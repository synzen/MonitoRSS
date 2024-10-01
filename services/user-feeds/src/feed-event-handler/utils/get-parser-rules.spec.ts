import { PostProcessParserRule } from "../../article-parser/constants";
import { getParserRules } from "./get-parser-rules";
import { describe, it } from "node:test";
import { deepStrictEqual } from "node:assert";

describe("getParserRulesFromUrl", () => {
  it("returns the correct parser rule for reddit", () => {
    const result = getParserRules({ url: "https://www.reddit.com" });

    deepStrictEqual(
      result.includes(PostProcessParserRule.RedditCommentLink),
      true
    );
  });
});
