import {
  Schema,
  Types,
  type Connection,
  type Model,
  type InferSchemaType,
} from "mongoose";
import { BaseMongooseRepository } from "./base.mongoose.repository";

export interface IEmailVerification {
  id: string;
  userId: string;
  email: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
}

const EmailVerificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    email: { type: String, required: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

EmailVerificationSchema.index({ userId: 1, email: 1 });
EmailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

type EmailVerificationDoc = InferSchemaType<typeof EmailVerificationSchema>;

// Append-only audit of dispatched verification sends, kept separate from the
// active-code collection (which is wiped per (user,email) on resend/confirm and
// so cannot count historical distinct targets). Used to cap how many DISTINCT
// addresses a single user can have codes sent to within a window. Self-pruning
// via TTL on createdAt.
const SEND_AUDIT_TTL_SECONDS = 24 * 60 * 60;

const EmailVerificationSendSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    email: { type: String, required: true },
  },
  { timestamps: true },
);

EmailVerificationSendSchema.index({ userId: 1, createdAt: 1 });
EmailVerificationSendSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: SEND_AUDIT_TTL_SECONDS },
);

type EmailVerificationSendDoc = InferSchemaType<
  typeof EmailVerificationSendSchema
>;

export class EmailVerificationMongooseRepository extends BaseMongooseRepository<
  IEmailVerification,
  EmailVerificationDoc
> {
  private model: Model<EmailVerificationDoc>;

  private sendModel: Model<EmailVerificationSendDoc>;

  constructor(connection: Connection) {
    super();
    this.model = connection.model<EmailVerificationDoc>(
      "EmailVerification",
      EmailVerificationSchema,
    );
    this.sendModel = connection.model<EmailVerificationSendDoc>(
      "EmailVerificationSend",
      EmailVerificationSendSchema,
    );
  }

  protected toEntity(
    doc: EmailVerificationDoc & { _id: Types.ObjectId },
  ): IEmailVerification {
    return {
      id: this.objectIdToString(doc._id),
      userId: this.objectIdToString(doc.userId),
      email: doc.email,
      codeHash: doc.codeHash,
      expiresAt: doc.expiresAt,
      attempts: doc.attempts,
      createdAt: doc.createdAt,
    };
  }

  async createCode(input: {
    userId: string;
    email: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<void> {
    const userId = this.stringToObjectId(input.userId);
    await this.model.deleteMany({ userId, email: input.email });
    await this.model.create({
      userId,
      email: input.email,
      codeHash: input.codeHash,
      expiresAt: input.expiresAt,
      attempts: 0,
    });
  }

  async findByUserEmail(
    userId: string,
    email: string,
  ): Promise<IEmailVerification | null> {
    const doc = await this.model
      .findOne({ userId: this.stringToObjectId(userId), email })
      .lean();

    return doc
      ? this.toEntity(doc as EmailVerificationDoc & { _id: Types.ObjectId })
      : null;
  }

  // Recency window evaluated against the DB's own clock ($$NOW), so it does not
  // depend on the app server's clock (no skew across instances).
  async hasRecentCode(
    userId: string,
    email: string,
    withinMs: number,
  ): Promise<boolean> {
    const doc = await this.model
      .findOne({
        userId: this.stringToObjectId(userId),
        email,
        $expr: { $gt: ["$createdAt", { $subtract: ["$$NOW", withinMs] }] },
      })
      .select("_id")
      .lean();

    return !!doc;
  }

  async incrementAttempts(userId: string, email: string): Promise<void> {
    await this.model.updateOne(
      { userId: this.stringToObjectId(userId), email },
      { $inc: { attempts: 1 } },
    );
  }

  async deleteForUserEmail(userId: string, email: string): Promise<void> {
    await this.model.deleteMany({
      userId: this.stringToObjectId(userId),
      email,
    });
  }

  // Drops every in-flight verification code and send-audit row for a user,
  // across all addresses. Used by account erasure.
  async deleteAllForUser(userId: string): Promise<void> {
    const id = this.stringToObjectId(userId);
    await this.model.deleteMany({ userId: id });
    await this.sendModel.deleteMany({ userId: id });
  }

  // Append a row to the send audit (used by the distinct-target cap). Separate
  // from createCode so the audit survives the per-(user,email) wipe on resend.
  async recordSend(userId: string, email: string): Promise<void> {
    await this.sendModel.create({
      userId: this.stringToObjectId(userId),
      email,
    });
  }

  // Count distinct target addresses this user has had codes sent to within the
  // window. Window evaluated against the DB clock ($$NOW) to avoid app clock skew.
  async countDistinctRecentTargets(
    userId: string,
    withinMs: number,
  ): Promise<number> {
    const result = await this.sendModel.aggregate<{ count: number }>([
      {
        $match: {
          userId: this.stringToObjectId(userId),
          $expr: { $gt: ["$createdAt", { $subtract: ["$$NOW", withinMs] }] },
        },
      },
      { $group: { _id: "$email" } },
      { $count: "count" },
    ]);

    return result[0]?.count ?? 0;
  }

  // Whether this user already targeted this exact address within the window (so
  // re-sending to it is not counted against the distinct-target cap).
  async hasRecentTarget(
    userId: string,
    email: string,
    withinMs: number,
  ): Promise<boolean> {
    const doc = await this.sendModel
      .findOne({
        userId: this.stringToObjectId(userId),
        email,
        $expr: { $gt: ["$createdAt", { $subtract: ["$$NOW", withinMs] }] },
      })
      .select("_id")
      .lean();

    return !!doc;
  }
}
