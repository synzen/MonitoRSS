import { InferType, object } from "yup";
import fetchRest from "@/utils/fetchRest";
import { WorkspaceSchema } from "../types";

export interface GetWorkspaceInput {
  workspaceSlug: string;
}

const GetWorkspaceOutputSchema = object({
  result: WorkspaceSchema,
}).required();

export type GetWorkspaceOutput = InferType<typeof GetWorkspaceOutputSchema>;

export const getWorkspace = async ({ workspaceSlug }: GetWorkspaceInput): Promise<GetWorkspaceOutput> => {
  const res = await fetchRest(`/api/v1/workspaces/${workspaceSlug}`, {
    validateSchema: GetWorkspaceOutputSchema,
  });

  return res as GetWorkspaceOutput;
};
