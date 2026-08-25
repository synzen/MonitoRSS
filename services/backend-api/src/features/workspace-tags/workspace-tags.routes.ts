import type { FastifyInstance } from "fastify";
import { requireAuthHook } from "../../infra/auth";
import { requireWorkspacesFeatureHook } from "../workspaces/workspaces.hooks";
import {
  createWorkspaceTagHandler,
  listWorkspaceTagsHandler,
} from "./workspace-tags.handlers";
import {
  CreateWorkspaceTagBodySchema,
  WorkspaceTagParamsSchema,
  type CreateWorkspaceTagBody,
  type WorkspaceTagParams,
} from "./workspace-tags.schemas";

export async function workspaceTagsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: WorkspaceTagParams }>("/:workspaceSlug/tags", {
    preHandler: [requireAuthHook, requireWorkspacesFeatureHook],
    schema: { params: WorkspaceTagParamsSchema },
    handler: listWorkspaceTagsHandler,
  });

  app.post<{
    Params: WorkspaceTagParams;
    Body: CreateWorkspaceTagBody;
  }>("/:workspaceSlug/tags", {
    preHandler: [requireAuthHook, requireWorkspacesFeatureHook],
    schema: {
      params: WorkspaceTagParamsSchema,
      body: CreateWorkspaceTagBodySchema,
    },
    handler: createWorkspaceTagHandler,
  });
}
