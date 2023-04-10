export interface PreviewEmbedInput {
  color?: string | null;
  url?: string | null;
  title?: string | null;
  description?: string | null;
  timestamp?: string | null;
  footer?: {
    timestamp?: string | null;
    text?: string | null;
    icon_url?: string | null;
  } | null;
  thumbnail?: {
    url?: string | null;
  } | null;
  author?: {
    name?: string | null;
    url?: string | null;
    icon_url?: string | null;
  } | null;
  fields?: Array<{
    name?: string | null;
    value?: string | null;
    inline?: boolean | null;
  }> | null;
  image?: {
    url?: string | null;
  } | null;
}
