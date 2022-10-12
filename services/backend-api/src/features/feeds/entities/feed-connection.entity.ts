import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { BaseConnectionDetails } from "./connection-details";

@Schema({
  timestamps: true,
  _id: false,
  versionKey: false,
})
export class FeedConnection {
  @Prop({
    type: Types.ObjectId,
    default: () => new Types.ObjectId(),
  })
  id: Types.ObjectId;

  @Prop({
    required: true,
  })
  name: string;

  @Prop({
    required: true,
    type: BaseConnectionDetails,
  })
  details: BaseConnectionDetails;

  updatedAt?: Date;
}

export const FeedConnectionSchema =
  SchemaFactory.createForClass(FeedConnection);
