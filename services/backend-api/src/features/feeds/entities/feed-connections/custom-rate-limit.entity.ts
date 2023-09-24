import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";

@Schema({
  _id: false,
  timestamps: false,
  versionKey: false,
})
export class CustomRateLimit {
  @Prop({
    required: true,
    default: () => new Types.ObjectId().toHexString(),
  })
  id: string;

  @Prop({
    required: true,
  })
  timeWindowSeconds: number;

  @Prop({
    required: true,
  })
  limit: number;
}

export const CustomRateLimitSchema =
  SchemaFactory.createForClass(CustomRateLimit);
