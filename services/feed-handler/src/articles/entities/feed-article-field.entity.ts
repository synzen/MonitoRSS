import { Entity, Property, PrimaryKey } from "@mikro-orm/core";

@Entity()
export class FeedArticleField {
  @PrimaryKey()
  id: number;

  @Property()
  feed_id: string;

  @Property()
  field_name: string;

  @Property()
  field_value: string;

  @Property()
  created_at: Date = new Date();
}
