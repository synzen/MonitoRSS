// ============================================================================
// V2 Component Schemas with Discriminators
// ============================================================================

import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { FeedConnectionDiscordComponentType } from "../../constants";
import { Schema as MongooseSchema } from "mongoose";

// --- Shared Schemas ---

@Schema({ _id: false, versionKey: false, timestamps: false })
class DiscordEmojiV2 {
  @Prop({ required: true })
  id: string;

  @Prop({ type: String, default: null })
  name?: string | null;

  @Prop({ type: Boolean, default: null })
  animated?: boolean | null;
}
const DiscordEmojiV2Schema = SchemaFactory.createForClass(DiscordEmojiV2);

@Schema({ _id: false, versionKey: false, timestamps: false })
class DiscordMediaV2 {
  @Prop({ required: true })
  url: string;
}
const DiscordMediaV2Schema = SchemaFactory.createForClass(DiscordMediaV2);

// --- Leaf Components ---

@Schema({ _id: false, versionKey: false, timestamps: false })
class DiscordTextDisplayV2 {
  @Prop({
    type: Number,
    enum: [FeedConnectionDiscordComponentType.TextDisplay],
    required: true,
  })
  type: FeedConnectionDiscordComponentType.TextDisplay;

  @Prop({ required: true })
  content: string;
}
const DiscordTextDisplayV2Schema =
  SchemaFactory.createForClass(DiscordTextDisplayV2);

@Schema({ _id: false, versionKey: false, timestamps: false })
class DiscordThumbnailV2 {
  @Prop({
    type: Number,
    enum: [FeedConnectionDiscordComponentType.Thumbnail],
    required: true,
  })
  type: FeedConnectionDiscordComponentType.Thumbnail;

  @Prop({ type: DiscordMediaV2Schema, required: true })
  media: DiscordMediaV2;

  @Prop({ type: String, maxlength: 1024, default: null })
  description?: string | null;

  @Prop({ type: Boolean, default: false })
  spoiler?: boolean;
}
const DiscordThumbnailV2Schema =
  SchemaFactory.createForClass(DiscordThumbnailV2);

@Schema({ _id: false, versionKey: false, timestamps: false })
class DiscordButtonV2 {
  @Prop({
    type: Number,
    enum: [FeedConnectionDiscordComponentType.Button],
    required: true,
  })
  type: FeedConnectionDiscordComponentType.Button;

  @Prop({ type: Number, min: 1, max: 6, required: true })
  style: number;

  @Prop({ type: String, maxlength: 80 })
  label?: string;

  @Prop({ type: DiscordEmojiV2Schema, default: null })
  emoji?: DiscordEmojiV2 | null;

  @Prop({ type: String, maxlength: 512, default: null })
  url?: string | null;

  @Prop({ type: Boolean, default: false })
  disabled?: boolean;
}
const DiscordButtonV2Schema = SchemaFactory.createForClass(DiscordButtonV2);

// --- Accessory Base (for discriminator) ---

@Schema({
  _id: false,
  versionKey: false,
  timestamps: false,
  discriminatorKey: "type",
})
class DiscordAccessoryV2Base {
  @Prop({
    type: Number,
    required: true,
    enum: [
      FeedConnectionDiscordComponentType.Button,
      FeedConnectionDiscordComponentType.Thumbnail,
    ],
  })
  type:
    | FeedConnectionDiscordComponentType.Button
    | FeedConnectionDiscordComponentType.Thumbnail;
}
const DiscordAccessoryV2BaseSchema = SchemaFactory.createForClass(
  DiscordAccessoryV2Base
);

// --- Section Component ---

@Schema({ _id: false, versionKey: false, timestamps: false })
export class DiscordSectionV2 {
  @Prop({
    type: Number,
    enum: [FeedConnectionDiscordComponentType.Section],
    required: true,
  })
  type: FeedConnectionDiscordComponentType.Section;

  @Prop({
    type: [DiscordTextDisplayV2Schema],
    required: true,
    validate: [
      (arr: DiscordTextDisplayV2[]) => arr.length >= 1 && arr.length <= 3,
      "Section must have 1-3 text display components",
    ],
  })
  components: DiscordTextDisplayV2[];

  @Prop({ type: DiscordAccessoryV2BaseSchema, required: true })
  accessory: DiscordButtonV2 | DiscordThumbnailV2;
}

export const DiscordSectionV2Schema =
  SchemaFactory.createForClass(DiscordSectionV2);

// Register accessory discriminators
DiscordSectionV2Schema.path<MongooseSchema.Types.Subdocument>(
  "accessory"
).discriminator(
  FeedConnectionDiscordComponentType.Button,
  DiscordButtonV2Schema
);
DiscordSectionV2Schema.path<MongooseSchema.Types.Subdocument>(
  "accessory"
).discriminator(
  FeedConnectionDiscordComponentType.Thumbnail,
  DiscordThumbnailV2Schema
);

// --- Action Row Component ---

@Schema({ _id: false, versionKey: false, timestamps: false })
export class DiscordActionRowV2 {
  @Prop({
    type: Number,
    enum: [FeedConnectionDiscordComponentType.ActionRow],
    required: true,
  })
  type: FeedConnectionDiscordComponentType.ActionRow;

  @Prop({
    type: [DiscordButtonV2Schema],
    required: true,
    validate: [
      (arr: DiscordButtonV2[]) => arr.length >= 1 && arr.length <= 5,
      "Action row must have 1-5 button components",
    ],
  })
  components: DiscordButtonV2[];
}

export const DiscordActionRowV2Schema =
  SchemaFactory.createForClass(DiscordActionRowV2);

// --- Top-Level Component Base (for discriminator) ---

@Schema({
  _id: false,
  versionKey: false,
  timestamps: false,
  discriminatorKey: "type",
})
class DiscordComponentV2Base {
  @Prop({
    type: Number,
    required: true,
    enum: [
      FeedConnectionDiscordComponentType.Section,
      FeedConnectionDiscordComponentType.ActionRow,
    ],
  })
  type:
    | FeedConnectionDiscordComponentType.Section
    | FeedConnectionDiscordComponentType.ActionRow;
}

export const DiscordComponentV2BaseSchema = SchemaFactory.createForClass(
  DiscordComponentV2Base
);
