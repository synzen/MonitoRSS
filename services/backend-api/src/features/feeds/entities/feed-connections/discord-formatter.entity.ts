import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema({
  _id: false,
  timestamps: false,
  versionKey: false,
})
export class DiscordFormatter {
  @Prop({
    required: false,
    default: false,
  })
  formatTables?: boolean;

  @Prop({
    required: false,
    default: false,
  })
  stripImages?: boolean;

  @Prop({
    required: false,
    default: false,
  })
  disableImageLinkPreviews?: boolean;

  @Prop({
    required: false,
    default: false,
  })
  ignoreNewLines?: boolean;
}

export const DiscordFormatterSchema =
  SchemaFactory.createForClass(DiscordFormatter);
