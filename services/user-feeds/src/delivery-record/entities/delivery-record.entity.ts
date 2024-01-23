import {
  Entity,
  Property,
  PrimaryKey,
  Enum,
  Index,
  OneToOne,
  Unique,
} from "@mikro-orm/core";
import { ArticleDeliveryStatus } from "../../shared";
import { ArticleDeliveryContentType } from "../../shared/types/article-delivery-content-type.type";

@Entity()
@Index({
  properties: ["feed_id", "status", "created_at"],
  name: "delivery_timeframe_count_index",
})
@Index({
  properties: ["medium_id", "status", "created_at"],
  name: "delivery_timeframe_medium_count_index",
})
@Index({
  properties: ["article_id_hash"],
  name: "article_id_hash_index",
})
@Index({
  // Used for querying delivery records for user views
  properties: ["feed_id", "parent", "created_at"],
  name: "feed_parent_created_at_index",
})
@Unique({
  properties: ["medium_id", "article_id_hash"],
  name: "delivery_record_medium_id_article_id_hash_unique",
})
export class DeliveryRecord {
  @PrimaryKey()
  id: string;

  @Property()
  feed_id: string;

  @Property()
  medium_id: string;

  @Property()
  created_at: Date = new Date();

  @Enum(() => ArticleDeliveryStatus)
  status: ArticleDeliveryStatus;

  @Enum({
    nullable: true,
    items: () => ArticleDeliveryContentType,
  })
  content_type?: ArticleDeliveryContentType | null;

  @OneToOne({
    nullable: true,
    default: null,
    entity: () => DeliveryRecord,
  })
  parent?: DeliveryRecord | null;

  @Property({
    nullable: true,
    type: "text",
  })
  internal_message?: string;

  @Property({
    nullable: true,
  })
  error_code?: string;

  @Property({
    nullable: true,
    default: null,
    type: "text",
  })
  external_detail?: string | null;

  @Property({
    nullable: true,
    default: null,
    type: "text",
  })
  article_id?: string | null;

  @Property({
    nullable: true,
    default: null,
    type: "text",
  })
  article_id_hash?: string | null;

  constructor(
    data: Omit<DeliveryRecord, "created_at">,
    overrides?: {
      created_at?: Date;
    }
  ) {
    this.id = data.id;
    this.feed_id = data.feed_id;
    this.status = data.status;
    this.error_code = data.error_code;
    this.internal_message = data.internal_message;
    this.medium_id = data.medium_id;
    this.parent = data.parent;
    this.content_type = data.content_type;
    this.external_detail = data.external_detail;
    this.article_id_hash = data.article_id_hash;

    if (overrides?.created_at) {
      this.created_at = overrides.created_at;
    }
  }
}
