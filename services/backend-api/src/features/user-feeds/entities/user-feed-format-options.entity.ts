import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema({
  timestamps: false,
  _id: false,
})
export class UserFeedFormatOptions {
  @Prop({
    required: false,
  })
  dateFormat?: string;

  @Prop({
    required: false,
  })
  dateTimezone?: string;

  @Prop({
    required: false,
  })
  dateLocale?: string;
}

export const UserFeedFormatOptionsSchema = SchemaFactory.createForClass(
  UserFeedFormatOptions
);
