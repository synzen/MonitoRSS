import { Type, type Static } from "@sinclair/typebox";
import { SLUG_MAX, SLUG_PATTERN } from "../../shared/utils/slugify";

const WorkspaceNameSchema = Type.String({ minLength: 1, maxLength: 100 });

const WorkspaceSlugFieldSchema = Type.String({
  minLength: 2,
  maxLength: SLUG_MAX,
  pattern: SLUG_PATTERN.source,
});

export const CreateWorkspaceBodySchema = Type.Object(
  {
    name: WorkspaceNameSchema,
    slug: WorkspaceSlugFieldSchema,
  },
  { additionalProperties: false },
);

export type CreateWorkspaceBody = Static<typeof CreateWorkspaceBodySchema>;

export const UpdateWorkspaceBodySchema = Type.Object(
  {
    name: Type.Optional(WorkspaceNameSchema),
    slug: Type.Optional(WorkspaceSlugFieldSchema),
  },
  { additionalProperties: false },
);

export type UpdateWorkspaceBody = Static<typeof UpdateWorkspaceBodySchema>;

export const WorkspaceSlugParamsSchema = Type.Object(
  {
    workspaceSlug: Type.String(),
  },
  { additionalProperties: false },
);

export type WorkspaceSlugParams = Static<typeof WorkspaceSlugParamsSchema>;

export const CreateWorkspaceInviteBodySchema = Type.Object(
  {
    email: Type.String({ minLength: 3, maxLength: 254, format: "email" }),
  },
  { additionalProperties: false },
);

export type CreateWorkspaceInviteBody = Static<
  typeof CreateWorkspaceInviteBodySchema
>;

export const WorkspaceInviteParamsSchema = Type.Object(
  {
    workspaceSlug: Type.String(),
    inviteId: Type.String(),
  },
  { additionalProperties: false },
);

export type WorkspaceInviteParams = Static<typeof WorkspaceInviteParamsSchema>;

export const WorkspaceBillingUpdateBodySchema = Type.Object(
  {
    prices: Type.Array(
      Type.Object(
        {
          priceId: Type.String({ minLength: 1 }),
          quantity: Type.Number({ minimum: 1 }),
        },
        { additionalProperties: false },
      ),
      { minItems: 1 },
    ),
  },
  { additionalProperties: false },
);

export type WorkspaceBillingUpdateBody = Static<
  typeof WorkspaceBillingUpdateBodySchema
>;

// userId accepts "@me" so a member can leave via DELETE .../members/@me; the
// handler resolves it to the caller's own id before routing by identity.
export const WorkspaceMemberParamsSchema = Type.Object(
  {
    workspaceSlug: Type.String(),
    userId: Type.String(),
  },
  { additionalProperties: false },
);

export type WorkspaceMemberParams = Static<typeof WorkspaceMemberParamsSchema>;
