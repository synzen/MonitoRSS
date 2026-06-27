import { InferType, object } from "yup";
import fetchRest from "@/utils/fetchRest";
import { WorkspaceManagedInviteSchema } from "../types";

export interface CreateWorkspaceInviteInput {
  workspaceSlug: string;
  email: string;
}

const CreateWorkspaceInviteOutputSchema = object({
  result: WorkspaceManagedInviteSchema,
}).required();

export type CreateWorkspaceInviteOutput = InferType<typeof CreateWorkspaceInviteOutputSchema>;

export const createWorkspaceInvite = async ({
  workspaceSlug,
  email,
}: CreateWorkspaceInviteInput): Promise<CreateWorkspaceInviteOutput> => {
  const res = await fetchRest(`/api/v1/workspaces/${workspaceSlug}/invites`, {
    validateSchema: CreateWorkspaceInviteOutputSchema,
    requestOptions: {
      method: "POST",
      body: JSON.stringify({ email }),
    },
  });

  return res as CreateWorkspaceInviteOutput;
};
