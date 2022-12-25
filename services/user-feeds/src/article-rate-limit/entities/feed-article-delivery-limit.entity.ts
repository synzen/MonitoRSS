import { Entity, PrimaryKey, Property, Unique } from "@mikro-orm/core";

@Entity()
@Unique({ properties: ["feed_id", "time_window_seconds"] })
export class FeedArticleDeliveryLimit {
  @PrimaryKey({
    autoincrement: true,
  })
  id: number;

  @Property()
  feed_id: string;

  @Property()
  limit: number;

  @Property()
  time_window_seconds: number;

  @Property()
  created_at: Date = new Date();

  @Property({
    onUpdate: () => new Date(),
  })
  updated_at: Date = new Date();

  constructor(
    data: Pick<
      FeedArticleDeliveryLimit,
      "feed_id" | "limit" | "time_window_seconds"
    >
  ) {
    this.feed_id = data.feed_id;
    this.limit = data.limit;
    this.time_window_seconds = data.time_window_seconds;
  }
}
