import { parse, valid } from "node-html-parser";
// @ts-expect-error - no types available
import { convert } from "html-to-text";
import { type FlattenedArticleWithoutId, PostProcessParserRule } from "./types";

interface SelectorDefinition {
  selector: string;
  format: string;
}

interface HtmlElement {
  attribs: Record<string, string>;
}

/**
 * Extracts image URLs and anchor hrefs from HTML content.
 */
export function extractExtraInfo(inputString: string): {
  images: string[];
  anchors: string[];
} {
  const isValid = valid(inputString);

  let images: string[] = [];
  let anchors: string[] = [];

  if (!isValid) {
    // fallback to using the slower html-to-text
    const imageSelector: SelectorDefinition = {
      selector: "img",
      format: "images",
    };

    const anchorSelector: SelectorDefinition = {
      selector: "a",
      format: "anchors",
    };

    convert(inputString, {
      formatters: {
        images: (elem: HtmlElement) => {
          const attribs = elem.attribs || {};
          const src = (attribs.src || "").trim();

          if (src) {
            images.push(src);
          }
        },
        anchors: (elem: HtmlElement) => {
          const href = elem.attribs.href;

          if (href) {
            anchors.push(href);
          }
        },
      },
      selectors: [imageSelector, anchorSelector],
    });

    return { images, anchors };
  }

  const root = parse(inputString);

  images = root
    .getElementsByTagName("img")
    .map((e) => e.getAttribute("src"))
    .filter((e): e is string => !!e);

  anchors = root
    .querySelectorAll("a")
    .map((e) => e.getAttribute("href"))
    .filter((e): e is string => !!e);

  return { images, anchors };
}

/**
 * Run pre-process rules on raw article data.
 * Currently handles joining categories array into a comma-separated string.
 */
export function runPreProcessRules<T>(
  rawArticle: T extends Record<string, unknown> ? T : Record<string, unknown>
): FlattenedArticleWithoutId {
  const flattenedArticle: FlattenedArticleWithoutId = {};

  const categories = rawArticle.categories;

  if (
    Array.isArray(categories) &&
    categories.every((item) => typeof item === "string")
  ) {
    flattenedArticle["processed::categories"] = categories.join(",");
  }

  return flattenedArticle;
}

/**
 * Run post-process rules on flattened article data.
 * Currently handles Reddit-specific link stripping.
 */
export function runPostProcessRules(
  flattenedArticle: FlattenedArticleWithoutId,
  rules?: PostProcessParserRule[]
): FlattenedArticleWithoutId {
  if (!rules?.length) {
    return flattenedArticle;
  }

  const stripRedditCommentLink = rules.includes(
    PostProcessParserRule.RedditCommentLink
  );

  const article = { ...flattenedArticle };

  if (stripRedditCommentLink && typeof article.description === "string") {
    article["processed::description::reddit1"] = article.description
      .replace("[link]", "")
      .replace("[comments]", "");
  }

  return article;
}

/**
 * Get parser rules based on feed URL.
 * Returns URL-specific parsing rules (e.g., Reddit-specific rules).
 */
export function getParserRules({
  url,
}: {
  url: string;
}): PostProcessParserRule[] {
  const rules: PostProcessParserRule[] = [];

  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.host === "www.reddit.com") {
      rules.push(PostProcessParserRule.RedditCommentLink);
    }
  } catch {
    // Invalid URL, return empty rules
  }

  return rules;
}
