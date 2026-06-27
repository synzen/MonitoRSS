import { Type, type Static } from "@sinclair/typebox";

export const WorkspaceInviteIdParamsSchema = Type.Object(
  {
    inviteId: Type.String(),
  },
  { additionalProperties: false },
);

export type WorkspaceInviteIdParams = Static<
  typeof WorkspaceInviteIdParamsSchema
>;

export const SendInviteVerificationBodySchema = Type.Object(
  {
    email: Type.String({
      maxLength: 254,
      pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$",
    }),
  },
  { additionalProperties: false },
);

export type SendInviteVerificationBody = Static<
  typeof SendInviteVerificationBodySchema
>;
