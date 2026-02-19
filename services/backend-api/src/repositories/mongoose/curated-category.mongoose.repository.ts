import {
  Schema,
  Types,
  type ClientSession,
  type Connection,
  type Model,
  type InferSchemaType,
} from "mongoose";
import type {
  ICuratedCategory,
  ICuratedCategoryRepository,
} from "../interfaces/curated-category.types";
import { BaseMongooseRepository } from "./base.mongoose.repository";

const CuratedCategorySchema = new Schema(
  {
    categoryId: { type: String, required: true },
    label: { type: String, required: true },
  },
  { collection: "curated_categories" },
);

type CuratedCategoryDoc = InferSchemaType<typeof CuratedCategorySchema>;

export class CuratedCategoryMongooseRepository
  extends BaseMongooseRepository<ICuratedCategory, CuratedCategoryDoc>
  implements ICuratedCategoryRepository
{
  private model: Model<CuratedCategoryDoc>;

  constructor(connection: Connection) {
    super();
    this.model = connection.model<CuratedCategoryDoc>(
      "CuratedCategory",
      CuratedCategorySchema,
    );
  }

  protected toEntity(
    doc: CuratedCategoryDoc & { _id: Types.ObjectId },
  ): ICuratedCategory {
    return {
      id: this.objectIdToString(doc._id),
      categoryId: doc.categoryId,
      label: doc.label,
    };
  }

  async getAll(): Promise<ICuratedCategory[]> {
    const docs = await this.model.find({}).lean();
    return docs.map((doc) =>
      this.toEntity(doc as CuratedCategoryDoc & { _id: Types.ObjectId }),
    );
  }

  async replaceAll(
    categories: Omit<ICuratedCategory, "id">[],
    session?: ClientSession,
  ): Promise<void> {
    await this.model.deleteMany({}, { session });
    if (categories.length > 0) {
      await this.model.insertMany(categories, { session });
    }
  }

  async deleteAll(session?: ClientSession): Promise<void> {
    await this.model.deleteMany({}, { session });
  }
}
