import { useMemo } from "react";

/**
 * Shared hook to extract valid feed fields from articles for template compatibility.
 * This ensures consistent field extraction logic across the connection dialog and message builder.
 *
 * Fields are considered valid if they:
 * - Are not 'id' or 'idHash' (internal fields)
 * - Have a truthy value (not undefined, null, or empty string)
 */
export function useTemplateFeedFields(articles: Array<Record<string, unknown>>): string[] {
  return useMemo(() => {
    if (articles.length === 0) return [];

    const firstArticle = articles[0];

    return Object.keys(firstArticle).filter((key) => {
      if (key === "id" || key === "idHash") {
        return false;
      }

      const value = firstArticle[key];

      return value !== undefined && value !== null && value !== "";
    });
  }, [articles]);
}
