import { Types } from "mongoose";

export abstract class BaseMongooseRepository<
  TEntity,
  TDoc,
  TId = Types.ObjectId,
> {
  protected abstract toEntity(doc: TDoc & { _id: TId }): TEntity;

  protected objectIdToString(id: Types.ObjectId): string;
  protected objectIdToString(id: Types.ObjectId | undefined): string | undefined;
  protected objectIdToString(id: Types.ObjectId | undefined): string | undefined {
    return id?.toString();
  }

  protected stringToObjectId(id: string): Types.ObjectId;
  protected stringToObjectId(id: string | undefined): Types.ObjectId | undefined;
  protected stringToObjectId(id: string | undefined): Types.ObjectId | undefined {
    return id ? new Types.ObjectId(id) : undefined;
  }
}
