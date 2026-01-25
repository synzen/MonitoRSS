export interface IUserFeedLimitOverride {
  id: string;
  additionalUserFeeds: number;
}

export interface IUserFeedLimitOverrideRepository {
  findById(id: string): Promise<IUserFeedLimitOverride | null>;
  findByIdsNotIn(excludeIds: string[]): Promise<IUserFeedLimitOverride[]>;
  deleteAll(): Promise<void>;
}
