export interface BulkFeedFilter {
  search?: string;
  filters?: {
    computedStatuses?: string[];
  };
  workspaceId?: string;
}
