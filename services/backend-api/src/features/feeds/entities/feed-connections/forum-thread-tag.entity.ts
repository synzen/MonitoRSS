import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Filters, FiltersSchema } from "./filters.entity";

@Schema({
  timestamps: false,
  _id: false,
})
export class ForumThreadTag {
  @Prop({
    required: true,
    type: String,
  })
  id: string;

  @Prop({
    type: FiltersSchema,
    required: false,
  })
  filters?: Filters;
}

export const ForumThreadTagSchema =
  SchemaFactory.createForClass(ForumThreadTag);
