import { Type, type Static } from "@sinclair/typebox";
import { WorkspaceSlugParamsSchema } from "../workspaces/workspaces.schemas";
import { WORKSPACE_TAG_COLORS } from "./workspace-tags.repository";

export const WorkspaceTagColorSchema = Type.Union(
  WORKSPACE_TAG_COLORS.map((color) => Type.Literal(color)),
);

export const CreateWorkspaceTagBodySchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 80 }),
    color: Type.Optional(WorkspaceTagColorSchema),
  },
  { additionalProperties: false },
);

export type CreateWorkspaceTagBody = Static<
  typeof CreateWorkspaceTagBodySchema
>;
export type WorkspaceTagParams = Static<typeof WorkspaceSlugParamsSchema>;

export { WorkspaceSlugParamsSchema as WorkspaceTagParamsSchema };
