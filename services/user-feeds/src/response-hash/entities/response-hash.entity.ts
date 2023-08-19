import { Entity, Property, PrimaryKey, Unique } from "@mikro-orm/core";

@Entity()
@Unique({
  name: "unique_feed_id",
  properties: ["feed_id"],
})
export class ResponseHash {
  @PrimaryKey({
    autoincrement: true,
  })
  id!: number;

  @Property()
  feed_id: string;

  @Property()
  hash: string;

  @Property({
    default: "now()",
  })
  updated_at: Date = new Date();

  constructor(data: Omit<ResponseHash, "id" | "created_at" | "updated_at">) {
    this.feed_id = data.feed_id;
    this.hash = data.hash;
  }
}
