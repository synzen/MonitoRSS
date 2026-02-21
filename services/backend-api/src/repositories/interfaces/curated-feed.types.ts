import type { ClientSession } from "mongoose";

export interface ICuratedFeed {
  id: string;
  url: string;
  title: string;
  category: string;
  domain: string;
  description: string;
  popular?: boolean;
  disabled?: boolean;
  createdAt?: Date;
}

export interface ICuratedFeedRepository {
  getAll(): Promise<ICuratedFeed[]>;
  replaceAll(
    feeds: Omit<ICuratedFeed, "id">[],
    session?: ClientSession,
  ): Promise<void>;
  deleteAll(session?: ClientSession): Promise<void>;
}
