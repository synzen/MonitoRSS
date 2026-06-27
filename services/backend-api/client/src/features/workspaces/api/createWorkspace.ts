import { InferType, object } from "yup";
import fetchRest from "@/utils/fetchRest";
import { WorkspaceDetailsSchema } from "../types";

export interface CreateWorkspaceInput {
  details: {
    name: string;
    slug: string;
  };
}

const CreateWorkspaceOutputSchema = object({
  result: WorkspaceDetailsSchema,
}).required();

export type CreateWorkspaceOutput = InferType<typeof CreateWorkspaceOutputSchema>;

export const createWorkspace = async ({ details }: CreateWorkspaceInput): Promise<CreateWorkspaceOutput> => {
  const res = await fetchRest("/api/v1/workspaces", {
    validateSchema: CreateWorkspaceOutputSchema,
    requestOptions: {
      method: "POST",
      body: JSON.stringify(details),
    },
  });

  return res as CreateWorkspaceOutput;
};
