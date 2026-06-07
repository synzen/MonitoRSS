import { InferType, object } from "yup";
import fetchRest from "@/utils/fetchRest";
import { WorkspaceDetailsSchema } from "../types";

export interface UpdateWorkspaceInput {
  workspaceSlug: string;
  details: {
    name?: string;
    slug?: string;
  };
}

const UpdateWorkspaceOutputSchema = object({
  result: WorkspaceDetailsSchema,
}).required();

export type UpdateWorkspaceOutput = InferType<typeof UpdateWorkspaceOutputSchema>;

export const updateWorkspace = async ({
  workspaceSlug,
  details,
}: UpdateWorkspaceInput): Promise<UpdateWorkspaceOutput> => {
  const res = await fetchRest(`/api/v1/workspaces/${workspaceSlug}`, {
    validateSchema: UpdateWorkspaceOutputSchema,
    requestOptions: {
      method: "PATCH",
      body: JSON.stringify(details),
    },
  });

  return res as UpdateWorkspaceOutput;
};
