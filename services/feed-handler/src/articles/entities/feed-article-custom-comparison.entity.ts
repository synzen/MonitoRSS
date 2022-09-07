import { Entity, Property, PrimaryKey, Unique } from "@mikro-orm/core";

@Entity()
@Unique({ properties: ["feed_id", "field_name"] })
export class FeedArticleCustomComparison {
  @PrimaryKey()
  id: number;

  @Property()
  feed_id: string;

  @Property()
  field_name: string;

  @Property()
  created_at: Date = new Date();

  constructor(data: Omit<FeedArticleCustomComparison, "id" | "created_at">) {
    this.feed_id = data.feed_id;
    this.field_name = data.field_name;
  }
}
