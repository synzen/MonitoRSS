import { Schema } from "mongoose";

export const FeedWebhookSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String },
    avatar: { type: String },
    disabled: { type: Boolean },
    url: { type: String },
  },
  { _id: false }
);

const FeedEmbedFieldSchema = new Schema(
  {
    name: { type: String, required: true },
    value: { type: String, required: true },
    inline: { type: Boolean },
  },
  { _id: false }
);

export const FeedEmbedSchema = new Schema(
  {
    title: { type: String },
    description: { type: String },
    url: { type: String },
    color: { type: String },
    footerText: { type: String },
    footerIconURL: { type: String },
    authorName: { type: String },
    authorIconURL: { type: String },
    authorURL: { type: String },
    thumbnailURL: { type: String },
    imageURL: { type: String },
    timestamp: { type: String },
    fields: { type: [FeedEmbedFieldSchema], default: [] },
    webhook: { type: FeedWebhookSchema },
  },
  { _id: false }
);
