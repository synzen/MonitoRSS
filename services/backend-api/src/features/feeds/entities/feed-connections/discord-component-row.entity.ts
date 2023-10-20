import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Schema as MongooseSchema } from "mongoose";
import {
  FeedConnectionDiscordComponentButtonStyle,
  FeedConnectionDiscordComponentType,
} from "../../constants";

@Schema({
  discriminatorKey: "type",
  timestamps: false,
  versionKey: false,
  _id: false,
})
class DiscordBaseComponent {
  @Prop({
    required: true,
  })
  id: string;

  @Prop({
    type: Number,
    required: true,
    enum: Object.values(FeedConnectionDiscordComponentType),
  })
  type: FeedConnectionDiscordComponentType;
}

const DiscordBaseComponentSchema =
  SchemaFactory.createForClass(DiscordBaseComponent);

@Schema({
  versionKey: false,
  timestamps: false,
})
class DiscordButtonComponent {
  type: FeedConnectionDiscordComponentType.Button;

  @Prop({
    required: true,
  })
  label: string;

  @Prop({
    required: [
      function (this: DiscordButtonComponent) {
        return this.style === FeedConnectionDiscordComponentButtonStyle.Link;
      },
      "URL is required for link-styled buttons",
    ],
  })
  url?: string;

  @Prop({
    type: Number,
    enum: Object.values(FeedConnectionDiscordComponentButtonStyle),
    required: true,
  })
  style: FeedConnectionDiscordComponentButtonStyle;
}

const DiscordButtonComponentSchema = SchemaFactory.createForClass(
  DiscordButtonComponent
);

@Schema({
  _id: false,
  versionKey: false,
  timestamps: false,
})
export class DiscordComponentRow {
  @Prop({
    required: true,
  })
  id: string;

  @Prop({
    type: [DiscordBaseComponentSchema],
    validate: [
      function (this: Array<DiscordComponentRow>) {
        return this.length <= 5;
      },
      "Discord component rows cannot have more than 5 components",
    ],
  })
  components?: Array<DiscordButtonComponent>;
}

export const DiscordComponentRowSchema =
  SchemaFactory.createForClass(DiscordComponentRow);

DiscordComponentRowSchema.path<MongooseSchema.Types.DocumentArray>(
  "components"
).discriminator(
  FeedConnectionDiscordComponentType.Button,
  DiscordButtonComponentSchema
);
