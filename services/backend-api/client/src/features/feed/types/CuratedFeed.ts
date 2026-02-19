export interface CuratedFeed {
  url: string;
  title: string;
  category: string;
  domain: string;
  description: string;
  popular?: boolean;
}

export interface CuratedCategory {
  id: string;
  label: string;
}

export interface CuratedFeedData {
  categories: CuratedCategory[];
  feeds: CuratedFeed[];
}
