import { Entity, Property, PrimaryKey, Index } from "@mikro-orm/core";

/**
 * A basic entity just to track retries. Can be made more complex later on if needed.
 */
@Entity()
@Index({
  properties: ["feed_id"],
  name: "feed_id",
})
export class FeedRetryRecord {
  @PrimaryKey()
  id: number;

  @Property({
    unique: true,
  })
  feed_id: string;

  @Property()
  attempts_so_far: number;

  @Property({
    nullable: true,
    type: "timestamp with time zone",
  })
  created_at: Date = new Date();

  constructor(data: Omit<FeedRetryRecord, "id">) {
    this.feed_id = data.feed_id;
    this.attempts_so_far = data.attempts_so_far;
  }
}
