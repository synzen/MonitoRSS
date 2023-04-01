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
}

export const DiscordFormatterSchema =
  SchemaFactory.createForClass(DiscordFormatter);
