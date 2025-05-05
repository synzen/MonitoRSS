import { ModelDefinition, Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Model } from "mongoose";

export enum PatronStatus {
  ACTIVE = "active_patron",
  FORMER = "former_patron",
  DECLINED = "declined_patron",
}

@Schema({
  collection: "patrons",
})
export class Patron {
  _id: string;

  @Prop({
    enum: Object.values(PatronStatus),
  })
  statusOverride?: PatronStatus;

  @Prop({
    required: true,
    enum: Object.values(PatronStatus),
  })
  status: PatronStatus;

  @Prop()
  lastCharge?: Date;

  @Prop({
    required: true,
  })
  pledgeLifetime: number;

  @Prop()
  pledgeOverride?: number;

  @Prop({
    required: true,
  })
  pledge: number;

  @Prop({
    required: true,
  })
  name: string;

  @Prop()
  discord?: string;

  @Prop({
    required: true,
  })
  email: string;
}

export type PatronDocument = Patron & Document;
export type PatronModel = Model<PatronDocument>;
export const PatronSchema = SchemaFactory.createForClass(Patron);
export const PatronFeature: ModelDefinition = {
  name: Patron.name,
  schema: PatronSchema,
};
