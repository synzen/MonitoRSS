import { InferType, array, object } from "yup";
import fetchRest from "@/utils/fetchRest";
import { WorkspaceTagSchema, type WorkspaceTagColor } from "./types";

const GetWorkspaceTagsOutputSchema = object({
  results: array(WorkspaceTagSchema.required()).required(),
}).required();

const CreateWorkspaceTagOutputSchema = object({
  result: WorkspaceTagSchema.required(),
}).required();

export type GetWorkspaceTagsOutput = InferType<typeof GetWorkspaceTagsOutputSchema>;
export type CreateWorkspaceTagOutput = InferType<typeof CreateWorkspaceTagOutputSchema>;

export interface CreateWorkspaceTagInput {
  workspaceSlug: string;
  data: { name: string; color?: WorkspaceTagColor };
}

export async function getWorkspaceTags(workspaceSlug: string): Promise<GetWorkspaceTagsOutput> {
  const result = await fetchRest(`/api/v1/workspaces/${encodeURIComponent(workspaceSlug)}/tags`, {
    validateSchema: GetWorkspaceTagsOutputSchema,
  });

  return result as GetWorkspaceTagsOutput;
}

export async function createWorkspaceTag({
  workspaceSlug,
  data,
}: CreateWorkspaceTagInput): Promise<CreateWorkspaceTagOutput> {
  const result = await fetchRest(`/api/v1/workspaces/${encodeURIComponent(workspaceSlug)}/tags`, {
    requestOptions: { method: "POST", body: JSON.stringify(data) },
    validateSchema: CreateWorkspaceTagOutputSchema,
  });

  return result as CreateWorkspaceTagOutput;
}
