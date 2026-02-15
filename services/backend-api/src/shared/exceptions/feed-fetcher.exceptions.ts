import { StandardException } from "./standard.exception";

export class FeedArticleNotFoundException extends StandardException {}

export class FeedFetcherStatusException extends StandardException {}

export class InvalidFiltersRegexException extends StandardException {}

export class InvalidPreviewCustomPlaceholdersRegexException extends StandardException {}

export class UnexpectedApiResponseException extends StandardException {}
