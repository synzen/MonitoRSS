import { parse, valid } from "node-html-parser";
import { INJECTED_ARTICLE_PLACEHOLDER_PREFIX } from "../constants";
import { extractExtraInfo } from "./utils";
import type { Article } from "./types";

/**
 * External feed property configuration for extracting content from article URLs.
 */
export interface ExternalFeedProperty {
  /** The article field containing the URL to fetch (e.g., "link") */
  sourceField: string;
  /** A user-defined label for the extracted content */
  label: string;
  /** CSS selector to find elements on the fetched page */
  cssSelector: string;
}

/**
 * Fetch function type for fetching external URLs.
 * Returns the body content or null if fetch failed.
 */
export type ExternalFetchFn = (url: string) => Promise<string | null>;

/**
 * Inject external content into articles by fetching URLs and extracting content.
 *
 * This mutates the article.flattened records in-place, matching user-feeds behavior.
 *
 * @param articles - The articles to inject content into
 * @param externalFeedProperties - The external feed property configurations
 * @param fetchFn - Function to fetch external URLs, returns body or null on failure
 */
export async function injectExternalContent(
  articles: Article[],
  externalFeedProperties: ExternalFeedProperty[],
  fetchFn: ExternalFetchFn
): Promise<void> {
  if (!externalFeedProperties?.length) {
    return;
  }

  for (const article of articles) {
    await injectContentForArticle(
      article.flattened,
      externalFeedProperties,
      fetchFn
    );
  }
}

/**
 * Inject external content for a single article.
 * Uses Promise.allSettled so one failure doesn't break others.
 * Caches parsed bodies by source field to avoid re-fetching the same URL.
 */
async function injectContentForArticle(
  targetRecord: Record<string, string>,
  externalFeedProperties: ExternalFeedProperty[],
  fetchFn: ExternalFetchFn
): Promise<void> {
  // Cache parsed bodies by source field value (URL) to avoid re-fetching
  // null = fetch failed, undefined = not yet fetched
  const parsedBodiesBySourceField: Record<
    string,
    ReturnType<typeof parse> | null
  > = {};

  await Promise.allSettled(
    externalFeedProperties.map(async ({ cssSelector, label, sourceField }) => {
      const sourceFieldValue = targetRecord[sourceField];

      if (!sourceFieldValue) {
        return;
      }

      let parsedBody = parsedBodiesBySourceField[sourceField];

      // If we previously failed to fetch this URL, skip
      if (parsedBody === null) {
        return;
      }

      // If not yet fetched, fetch and parse
      if (parsedBody === undefined) {
        const body = await fetchFn(sourceFieldValue);

        if (!body) {
          console.error(`Failed to fetch external content`, {
            sourceField,
            sourceFieldValue,
          });
          parsedBodiesBySourceField[sourceField] = null;
          return;
        }

        if (!valid(body)) {
          parsedBodiesBySourceField[sourceField] = null;
          return;
        }

        parsedBody = parse(body);
        parsedBodiesBySourceField[sourceField] = parsedBody;
      }

      // Query the CSS selector and extract content (max 10 matches)
      parsedBody
        .querySelectorAll(cssSelector)
        .slice(0, 10)
        .forEach((element, index) => {
          const outerHtmlOfElement = element?.outerHTML || "";

          const key =
            `${INJECTED_ARTICLE_PLACEHOLDER_PREFIX}${sourceField}::${label}` +
            `${index}`;

          targetRecord[key] = outerHtmlOfElement;

          // Extract images and anchors from the injected content
          const { images: imageList, anchors: anchorList } =
            extractExtraInfo(outerHtmlOfElement);

          if (imageList.length) {
            for (let i = 0; i < imageList.length; i++) {
              const image = imageList[i];
              const imageKey = `${key}::image${i}`;
              targetRecord[imageKey] = image!;
            }
          }

          if (anchorList.length) {
            for (let i = 0; i < anchorList.length; i++) {
              const anchor = anchorList[i];
              const anchorKey = `${key}::anchor${i}`;
              targetRecord[anchorKey] = anchor!;
            }
          }
        });
    })
  );
}
