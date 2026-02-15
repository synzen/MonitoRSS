import { Type, type Static } from "@sinclair/typebox";

// Shared schemas
const PendingInviteFeedSchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  url: Type.String(),
  ownerDiscordUserId: Type.String(),
});

const PendingInviteSchema = Type.Object({
  id: Type.String(),
  type: Type.Optional(
    Type.Union([Type.Literal("CO_MANAGE"), Type.Literal("TRANSFER")]),
  ),
  feed: PendingInviteFeedSchema,
});

// GET / - Get pending invites
export const GetMyPendingInvitesResponseSchema = Type.Object({
  results: Type.Array(PendingInviteSchema),
});

export type GetMyPendingInvitesResponse = Static<
  typeof GetMyPendingInvitesResponseSchema
>;

// GET /pending - Get pending invite count
export const GetPendingInviteCountResponseSchema = Type.Object({
  total: Type.Number(),
});

export type GetPendingInviteCountResponse = Static<
  typeof GetPendingInviteCountResponseSchema
>;

// POST / - Create invite
const ConnectionInputSchema = Type.Object({
  connectionId: Type.String({ minLength: 1 }),
});

export const CreateInviteBodySchema = Type.Object(
  {
    feedId: Type.String({ minLength: 1 }),
    discordUserId: Type.String({ minLength: 1 }),
    type: Type.Union([Type.Literal("CO_MANAGE"), Type.Literal("TRANSFER")]),
    connections: Type.Optional(Type.Array(ConnectionInputSchema)),
  },
  { additionalProperties: false },
);

export type CreateInviteBody = Static<typeof CreateInviteBodySchema>;

export const CreateInviteResponseSchema = Type.Object({
  result: Type.Object({
    status: Type.Literal("SUCCESS"),
  }),
});

export type CreateInviteResponse = Static<typeof CreateInviteResponseSchema>;

// PATCH /:id - Update invite (owner only - connections)
export const UpdateInviteBodySchema = Type.Object(
  {
    connections: Type.Optional(
      Type.Union([Type.Array(ConnectionInputSchema), Type.Null()]),
    ),
  },
  { additionalProperties: false },
);

export type UpdateInviteBody = Static<typeof UpdateInviteBodySchema>;

export const UpdateInviteResponseSchema = Type.Object({
  result: Type.Object({
    status: Type.Literal("SUCCESS"),
  }),
});

export type UpdateInviteResponse = Static<typeof UpdateInviteResponseSchema>;

// PATCH /:id/status - Update invite status (invitee only)
export const UpdateInviteStatusBodySchema = Type.Object(
  {
    status: Type.Union([Type.Literal("ACCEPTED"), Type.Literal("DECLINED")]),
  },
  { additionalProperties: false },
);

export type UpdateInviteStatusBody = Static<
  typeof UpdateInviteStatusBodySchema
>;

export const UpdateInviteStatusResponseSchema = Type.Object({
  result: Type.Object({
    status: Type.Literal("SUCCESS"),
  }),
});

export type UpdateInviteStatusResponse = Static<
  typeof UpdateInviteStatusResponseSchema
>;

// Route params
export const InviteIdParamsSchema = Type.Object({
  id: Type.String(),
});

export type InviteIdParams = Static<typeof InviteIdParamsSchema>;
