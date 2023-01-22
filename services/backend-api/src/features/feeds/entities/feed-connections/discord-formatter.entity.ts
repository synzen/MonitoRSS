import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema({
  _id: false,
  timestamps: false,
  versionKey: false,
})
export class DiscordFormatter {
  @Prop({
    required: true,
    default: false,
  })
  formatTables: boolean;

  @Prop({
    required: true,
    default: false,
  })
  stripImages: boolean;
}

export const DiscordFormatterSchema =
  SchemaFactory.createForClass(DiscordFormatter);
