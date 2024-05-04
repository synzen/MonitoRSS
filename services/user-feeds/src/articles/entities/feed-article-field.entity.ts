import { Entity, Property, PrimaryKey, Index } from "@mikro-orm/core";

@Entity()
@Index({
  properties: ["feed_id", "field_name", "field_value", "is_hashed"],
  name: "article_property_idx",
})
@Index({
  properties: ["created_at"],
  name: "created_at_idx",
})
export class FeedArticleField {
  @PrimaryKey()
  id: number;

  @Property()
  feed_id: string;

  @Property()
  field_name: string;

  @Property({
    type: "text",
  })
  field_value: string;

  @Property({
    type: "boolean",
    default: false,
  })
  is_hashed? = false;

  @Property()
  created_at: Date = new Date();

  constructor(data: Omit<FeedArticleField, "id" | "created_at">) {
    this.feed_id = data.feed_id;
    this.field_name = data.field_name;
    this.field_value = data.field_value;
    this.is_hashed = data.is_hashed || false;
  }
}
