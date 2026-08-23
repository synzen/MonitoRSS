import type { FastifyReply, FastifyRequest } from "fastify";
import type {
  CreateWorkspaceTagBody,
  WorkspaceTagParams,
} from "./workspace-tags.schemas";
import { toWorkspaceTagHttpError } from "./workspace-tags.http-errors";
import { toWorkspaceTagSummary } from "./workspace-tags.service";

async function resolveWorkspaceForMember(
  request: FastifyRequest<{ Params: WorkspaceTagParams }>,
) {
  return request.container.workspacesService.getWorkspaceForMemberBySlug(
    request.params.workspaceSlug,
    request.userId as string,
  );
}

export async function listWorkspaceTagsHandler(
  request: FastifyRequest<{ Params: WorkspaceTagParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { workspace } = await resolveWorkspaceForMember(request);
  const tags = await request.container.workspaceTagRepository.findByWorkspace(
    workspace.id,
  );
  const results = tags.map(toWorkspaceTagSummary);

  return reply.status(200).send({ results });
}

export async function createWorkspaceTagHandler(
  request: FastifyRequest<{
    Params: WorkspaceTagParams;
    Body: CreateWorkspaceTagBody;
  }>,
  reply: FastifyReply,
): Promise<void> {
  const { workspace } = await resolveWorkspaceForMember(request);
  const result = await request.container.workspaceTagsService
    .create({
      workspaceId: workspace.id,
      name: request.body.name,
      color: request.body.color,
    })
    .catch((error) => {
      throw toWorkspaceTagHttpError(error);
    });

  return reply.status(201).send({ result });
}
