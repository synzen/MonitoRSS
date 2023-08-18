export interface UserFeedFormatOptions {
  dateFormat: string | undefined;
  dateTimezone: string | undefined;
  disableImageLinkPreviews: boolean | undefined;
  customPlaceholders:
    | Array<{
        id: string;
        sourcePlaceholder: string;
        regexSearch: string;
        replacementString: string;
      }>
    | undefined;
}
