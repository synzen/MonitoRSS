import { parse, valid } from "node-html-parser";
import { INJECTED_ARTICLE_PLACEHOLDER_PREFIX } from "../../shared/constants";
import { extractExtraInfo } from "./utils";
import { logger } from "../../shared/utils";
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

export enum ExternalContentErrorType {
  FETCH_FAILED = "FETCH_FAILED",
  HTML_PARSE_FAILED = "HTML_PARSE_FAILED",
  INVALID_CSS_SELECTOR = "INVALID_CSS_SELECTOR",
  NO_SELECTOR_MATCH = "NO_SELECTOR_MATCH",
}

export interface ExternalContentError {
  articleId: string;
  sourceField: string;
  label: string;
  cssSelector: string;
  errorType: ExternalContentErrorType;
  message?: string;
  statusCode?: number;
  pageHtml?: string;
  pageHtmlTruncated?: boolean;
}

export interface ExternalFetchResult {
  body: string | null;
  statusCode?: number;
}

export type ExternalFetchFn = (url: string) => Promise<ExternalFetchResult>;

export interface InjectExternalContentOptions {
  /** Whether to include raw HTML in NO_SELECTOR_MATCH errors for troubleshooting */
  includeHtmlInErrors?: boolean;
}

const CONCURRENT_ARTICLE_LIMIT = 5;
const MAX_HTML_SIZE = 50 * 1024; // 50KB limit for HTML in errors

/**
 * Inject external content into articles by fetching URLs and extracting content.
 *
 * This mutates the article.flattened records in-place, matching user-feeds behavior.
 * Processes up to 5 articles concurrently for better performance.
 *
 * @param articles - The articles to inject content into
 * @param externalFeedProperties - The external feed property configurations
 * @param fetchFn - Function to fetch external URLs, returns body or null on failure
 * @param options - Optional settings for injection behavior
 * @returns Array of errors encountered during injection
 */
export async function injectExternalContent(
  articles: Article[],
  externalFeedProperties: ExternalFeedProperty[],
  fetchFn: ExternalFetchFn,
  options?: InjectExternalContentOptions
): Promise<ExternalContentError[]> {
  if (!externalFeedProperties?.length) {
    return [];
  }

  const allErrors: ExternalContentError[] = [];

  // Process articles in batches of CONCURRENT_ARTICLE_LIMIT
  for (let i = 0; i < articles.length; i += CONCURRENT_ARTICLE_LIMIT) {
    const batch = articles.slice(i, i + CONCURRENT_ARTICLE_LIMIT);

    const batchResults = await Promise.all(
      batch.map((article) =>
        injectContentForArticle(
          article.flattened.id,
          article.flattened,
          externalFeedProperties,
          fetchFn,
          options
        )
      )
    );

    for (const errors of batchResults) {
      allErrors.push(...errors);
    }
  }

  return allErrors;
}

interface FetchCacheEntry {
  parsedBody: ReturnType<typeof parse> | null;
  rawHtml?: string;
  statusCode?: number;
  error?: ExternalContentError;
}

/**
 * Inject external content for a single article.
 * Caches parsed bodies by source field to avoid re-fetching the same URL.
 * Returns array of errors encountered.
 */
async function injectContentForArticle(
  articleId: string,
  targetRecord: Record<string, string>,
  externalFeedProperties: ExternalFeedProperty[],
  fetchFn: ExternalFetchFn,
  options?: InjectExternalContentOptions
): Promise<ExternalContentError[]> {
  const errors: ExternalContentError[] = [];

  // Cache parsed bodies by source field value (URL) to avoid re-fetching
  const cacheBySourceField: Record<string, FetchCacheEntry> = {};

  for (const { cssSelector, label, sourceField } of externalFeedProperties) {
    const sourceFieldValue = targetRecord[sourceField];

    if (!sourceFieldValue) {
      continue;
    }

    let cacheEntry = cacheBySourceField[sourceField];

    // If we previously failed to fetch this URL, report error and skip
    if (cacheEntry && cacheEntry.parsedBody === null) {
      if (cacheEntry.error) {
        errors.push({
          ...cacheEntry.error,
          label,
          cssSelector,
        });
      }
      continue;
    }

    // If not yet fetched, fetch and parse
    if (!cacheEntry) {
      const result = await fetchFn(sourceFieldValue);

      if (!result.body) {
        logger.error(`Failed to fetch article injection`, {
          sourceField,
          sourceFieldValue,
        });

        const error: ExternalContentError = {
          articleId,
          sourceField,
          label,
          cssSelector,
          errorType: ExternalContentErrorType.FETCH_FAILED,
          ...(result.statusCode !== undefined && {
            statusCode: result.statusCode,
          }),
        };

        cacheBySourceField[sourceField] = {
          parsedBody: null,
          statusCode: result.statusCode,
          error: {
            articleId,
            sourceField,
            label: "",
            cssSelector: "",
            errorType: ExternalContentErrorType.FETCH_FAILED,
            ...(result.statusCode !== undefined && {
              statusCode: result.statusCode,
            }),
          },
        };
        errors.push(error);
        continue;
      }

      try {
        const parsedBody = parse(result.body);

        // Strip script tags from HTML for security/cleanliness when showing to users
        const cleanedHtml = (() => {
          const docForCleaning = parse(result.body);
          docForCleaning.querySelectorAll("script").forEach((el) => el.remove());
          return docForCleaning.toString();
        })();

        cacheBySourceField[sourceField] = { parsedBody, rawHtml: cleanedHtml };
        cacheEntry = cacheBySourceField[sourceField];
      } catch (err) {
        const error: ExternalContentError = {
          articleId,
          sourceField,
          label,
          cssSelector,
          errorType: ExternalContentErrorType.HTML_PARSE_FAILED,
          message: err instanceof Error ? err.message : String(err),
        };
        cacheBySourceField[sourceField] = {
          parsedBody: null,
          error: {
            articleId,
            sourceField,
            label: "",
            cssSelector: "",
            errorType: ExternalContentErrorType.HTML_PARSE_FAILED,
            message: err instanceof Error ? err.message : String(err),
          },
        };
        errors.push(error);
        continue;
      }
    }

    const parsedBody = cacheEntry!.parsedBody!;

    // Query the CSS selector and extract content (max 10 matches)
    let queriedContent;
    try {
      queriedContent = parsedBody.querySelectorAll(cssSelector).slice(0, 10);
    } catch (err) {
      errors.push({
        articleId,
        sourceField,
        label,
        cssSelector,
        errorType: ExternalContentErrorType.INVALID_CSS_SELECTOR,
        message: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    // Track when selector matches nothing (previously silent failure)
    if (queriedContent.length === 0) {
      const rawHtml = cacheEntry?.rawHtml;
      const error: ExternalContentError = {
        articleId,
        sourceField,
        label,
        cssSelector,
        errorType: ExternalContentErrorType.NO_SELECTOR_MATCH,
        message: `CSS selector "${cssSelector}" matched 0 elements`,
      };

      // Only include HTML in errors when requested (for preview/troubleshooting)
      if (options?.includeHtmlInErrors && rawHtml) {
        error.pageHtml =
          rawHtml.length > MAX_HTML_SIZE
            ? rawHtml.substring(0, MAX_HTML_SIZE)
            : rawHtml;
        error.pageHtmlTruncated = rawHtml.length > MAX_HTML_SIZE;
      }

      errors.push(error);
      continue;
    }

    queriedContent.forEach((element, index) => {
      const outerHtmlOfElement = element?.outerHTML || "";

      const key =
        `${INJECTED_ARTICLE_PLACEHOLDER_PREFIX}${sourceField}::${label}` +
        `${index}`;

      targetRecord[key] = outerHtmlOfElement;

      Object.keys(element.attributes).forEach((attrName) => {
        const attrKey = `${key}::attr::${attrName}`;
        const attrValue = element.attributes[attrName];

        if (attrValue) {
          targetRecord[attrKey] = attrValue;
        }
      });

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
  }

  return errors;
}
