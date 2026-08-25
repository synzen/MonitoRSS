import {
  Schema,
  Types,
  type ClientSession,
  type Connection,
  type InferSchemaType,
  type Model,
} from "mongoose";
import {
  WorkspaceTagLimitReachedError,
  WorkspaceTagNameTakenError,
} from "./workspace-tags.errors";

export const WORKSPACE_TAG_COLORS = [
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "pink",
] as const;

export type WorkspaceTagColor = (typeof WORKSPACE_TAG_COLORS)[number];

export interface WorkspaceTag {
  id: string;
  workspaceId: string;
  name: string;
  normalizedName: string;
  color?: WorkspaceTagColor;
}

export type WorkspaceTagSummary = Pick<WorkspaceTag, "id" | "name" | "color">;

const WorkspaceTagSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    normalizedName: { type: String, required: true },
    color: { type: String, enum: WORKSPACE_TAG_COLORS },
  },
  { timestamps: true },
);

WorkspaceTagSchema.index(
  { workspaceId: 1, normalizedName: 1 },
  { unique: true },
);
WorkspaceTagSchema.index({ workspaceId: 1, normalizedName: 1, _id: 1 });

type WorkspaceTagDoc = InferSchemaType<typeof WorkspaceTagSchema>;
interface WorkspaceLockDoc {
  tagCapacityVersion?: number;
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: number }).code === 11000
  );
}

export class WorkspaceTagMongooseRepository {
  private readonly model: Model<WorkspaceTagDoc>;

  private readonly workspaceModel: Model<WorkspaceLockDoc>;

  constructor(connection: Connection) {
    this.model = connection.model<WorkspaceTagDoc>(
      "WorkspaceTag",
      WorkspaceTagSchema,
    );
    this.workspaceModel = connection.model<WorkspaceLockDoc>("Workspace");
  }

  private toEntity(
    doc: WorkspaceTagDoc & { _id: Types.ObjectId },
  ): WorkspaceTag {
    return {
      id: doc._id.toString(),
      workspaceId: doc.workspaceId.toString(),
      name: doc.name,
      normalizedName: doc.normalizedName,
      color: doc.color,
    };
  }

  async createWithLimit(input: {
    workspaceId: string;
    name: string;
    normalizedName: string;
    color?: WorkspaceTagColor;
    limit: number;
  }): Promise<WorkspaceTag> {
    const session = await this.model.db.startSession();
    let created: WorkspaceTag | undefined;

    try {
      await session.withTransaction(async () => {
        await this.lockWorkspace(input.workspaceId, session);
        const count = await this.model
          .countDocuments({
            workspaceId: new Types.ObjectId(input.workspaceId),
          })
          .session(session);

        if (count >= input.limit) {
          throw new WorkspaceTagLimitReachedError();
        }

        const [doc] = await this.model.create(
          [
            {
              workspaceId: new Types.ObjectId(input.workspaceId),
              name: input.name,
              normalizedName: input.normalizedName,
              color: input.color,
            },
          ],
          { session },
        );

        created = this.toEntity(
          doc!.toObject() as WorkspaceTagDoc & { _id: Types.ObjectId },
        );
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new WorkspaceTagNameTakenError();
      }

      throw error;
    } finally {
      await session.endSession();
    }

    if (!created) {
      throw new Error("Workspace tag transaction returned no result");
    }

    return created;
  }

  private async lockWorkspace(
    workspaceId: string,
    session: ClientSession,
  ): Promise<void> {
    const result = await this.workspaceModel.updateOne(
      { _id: new Types.ObjectId(workspaceId) },
      { $inc: { tagCapacityVersion: 1 } },
      { session },
    );

    if (result.matchedCount !== 1) {
      throw new Error(
        `Workspace ${workspaceId} disappeared during tag creation`,
      );
    }
  }

  async findByWorkspace(workspaceId: string): Promise<WorkspaceTag[]> {
    const docs = await this.model
      .find({ workspaceId: new Types.ObjectId(workspaceId) })
      .sort({ normalizedName: 1, _id: 1 })
      .lean();

    return docs.map((doc) =>
      this.toEntity(doc as WorkspaceTagDoc & { _id: Types.ObjectId }),
    );
  }

  async findByIdsForWorkspace(
    workspaceId: string,
    tagIds: string[],
  ): Promise<WorkspaceTag[]> {
    if (tagIds.length === 0) {
      return [];
    }

    const docs = await this.model
      .find({
        _id: { $in: tagIds.map((id) => new Types.ObjectId(id)) },
        workspaceId: new Types.ObjectId(workspaceId),
      })
      .sort({ normalizedName: 1, _id: 1 })
      .lean();

    return docs.map((doc) =>
      this.toEntity(doc as WorkspaceTagDoc & { _id: Types.ObjectId }),
    );
  }

  areAllValidIds(tagIds: string[]): boolean {
    return tagIds.every((id) => Types.ObjectId.isValid(id));
  }
}
