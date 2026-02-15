export interface IFeedEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface IFeedWebhook {
  id: string;
  name?: string;
  avatar?: string;
  disabled?: boolean;
  url?: string;
}

export interface IFeedEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: string;
  footerText?: string;
  footerIconURL?: string;
  authorName?: string;
  authorIconURL?: string;
  authorURL?: string;
  thumbnailURL?: string;
  imageURL?: string;
  timestamp?: string;
  fields?: IFeedEmbedField[];
  webhook?: IFeedWebhook;
}
