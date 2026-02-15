import { ExternalContentError, ExternalContentErrorType } from "../../feed/types";

export function getErrorTypeLabel(errorType: ExternalContentErrorType): string {
  switch (errorType) {
    case ExternalContentErrorType.FETCH_FAILED:
      return "Page could not be loaded";
    case ExternalContentErrorType.HTML_PARSE_FAILED:
      return "Page content could not be read";
    case ExternalContentErrorType.INVALID_CSS_SELECTOR:
      return "Invalid CSS selector";
    case ExternalContentErrorType.NO_SELECTOR_MATCH:
      return "Selector found no matches";
    default:
      return "Unknown error";
  }
}

export function getErrorGuidance(errorType: ExternalContentErrorType, statusCode?: number): string {
  if (errorType === ExternalContentErrorType.FETCH_FAILED) {
    if (statusCode === 404) {
      return "The linked page may have been removed or the URL is incorrect.";
    }

    if (statusCode === 403) {
      return "This website may block automated requests.";
    }

    if (statusCode === 401) {
      return "This page requires authentication to access.";
    }

    if (statusCode && statusCode >= 500) {
      return "The external website is experiencing issues - try again later.";
    }

    return "The page could not be fetched. Check that the URL is accessible.";
  }

  if (errorType === ExternalContentErrorType.HTML_PARSE_FAILED) {
    return "The page structure may be incompatible (JavaScript-heavy or unusual HTML).";
  }

  if (errorType === ExternalContentErrorType.INVALID_CSS_SELECTOR) {
    return "Fix required: Check the CSS selector syntax.";
  }

  if (errorType === ExternalContentErrorType.NO_SELECTOR_MATCH) {
    return "The CSS selector is valid but matched no elements on the page. Click 'View Page Source' to inspect the HTML.";
  }

  return "";
}

export interface CategorizedErrors {
  configErrors: ExternalContentError[];
  selectorWarnings: ExternalContentError[];
  externalErrors: ExternalContentError[];
}

export function categorizeErrors(errors: ExternalContentError[]): CategorizedErrors {
  const configErrors: ExternalContentError[] = [];
  const selectorWarnings: ExternalContentError[] = [];
  const externalErrors: ExternalContentError[] = [];

  errors.forEach((error) => {
    if (error.errorType === ExternalContentErrorType.INVALID_CSS_SELECTOR) {
      configErrors.push(error);
    } else if (error.errorType === ExternalContentErrorType.NO_SELECTOR_MATCH) {
      selectorWarnings.push(error);
    } else {
      externalErrors.push(error);
    }
  });

  return { configErrors, selectorWarnings, externalErrors };
}

export function getAffectedLabels(errors: ExternalContentError[]): string[] {
  const labels = new Set<string>();
  errors.forEach((error) => labels.add(error.label));

  return Array.from(labels);
}

export function formatLabelList(labels: string[], maxShow = 2): string {
  if (labels.length === 0) {
    return "";
  }

  if (labels.length === 1) {
    return `"${labels[0]}"`;
  }

  if (labels.length <= maxShow) {
    return labels.map((l) => `"${l}"`).join(", ");
  }

  const shown = labels.slice(0, maxShow).map((l) => `"${l}"`);
  const remaining = labels.length - maxShow;

  return `${shown.join(", ")} and ${remaining} other${remaining > 1 ? "s" : ""}`;
}

export function getAlertSeverity(errors: ExternalContentError[]): "error" | "warning" {
  const hasConfigError = errors.some(
    (e) => e.errorType === ExternalContentErrorType.INVALID_CSS_SELECTOR,
  );

  return hasConfigError ? "error" : "warning";
}
