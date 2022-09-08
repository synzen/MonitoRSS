export interface FeedV2Event {
  id: string;
  url: string;
  passingComparisons: string[];
  blockingComparisons: string[];
}
