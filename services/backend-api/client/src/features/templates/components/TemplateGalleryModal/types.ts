export interface Branding {
  name: string;
  iconUrl?: string;
}

export interface Article {
  id: string;
  title?: string;
  [key: string]: unknown;
}
