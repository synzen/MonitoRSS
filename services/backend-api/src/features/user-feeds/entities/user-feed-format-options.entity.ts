import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema({
  timestamps: false,
  _id: false,
})
export class UserFeedFormatOptionsCustomPlaceholder {
  @Prop({
    required: true,
  })
  id: string;

  @Prop({
    required: true,
  })
  regexSearch: string;

  @Prop({
    required: true,
  })
  replacementString: string;

  @Prop({
    required: true,
  })
  sourcePlaceholder: string;
}

export const UserFeedFormatOptionsCustomPlaceholderSchema =
  SchemaFactory.createForClass(UserFeedFormatOptionsCustomPlaceholder);

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
    type: [UserFeedFormatOptionsCustomPlaceholderSchema],
  })
  customPlaceholders?: UserFeedFormatOptionsCustomPlaceholder[];
}

export const UserFeedFormatOptionsSchema = SchemaFactory.createForClass(
  UserFeedFormatOptions
);
