/**
 * Discord builds its own rich preview card by fetching the article page and
 * scraping its OpenGraph metadata. That only happens for a bare link in a
 * plain-text message. The v2 component templates (Rich Embed, Compact Card,
 * Media Gallery) set the components-v2 flag and suppress the unfurl, so the
 * disclosure must NOT show for them.
 *
 * A bare link is a URL that is NOT wrapped in <...> (which suppresses the
 * unfurl) and NOT part of markdown link syntax [text](url).
 */

// eslint-disable-next-line no-bitwise
const DISCORD_COMPONENTS_V2_FLAG = 1 << 15;

// A URL that is not immediately preceded by ( or < and not followed by ).
// Wrapped forms <url> and [text](url) both prevent the auto-embed.
const BARE_URL_REGEX = /(^|[^(<])https?:\/\/[^\s<>)]+/;

interface PreviewMessageLike {
  content?: string | null;
  flags?: number | null;
}

export function messageMayUnfurl(message: PreviewMessageLike | undefined): boolean {
  if (!message) {
    return false;
  }

  // eslint-disable-next-line no-bitwise
  const isV2 = ((message.flags ?? 0) & DISCORD_COMPONENTS_V2_FLAG) !== 0;

  if (isV2) {
    return false;
  }

  return !!message.content && BARE_URL_REGEX.test(message.content);
}

export function previewMayUnfurl(messages: Array<PreviewMessageLike>): boolean {
  return messages.some(messageMayUnfurl);
}
