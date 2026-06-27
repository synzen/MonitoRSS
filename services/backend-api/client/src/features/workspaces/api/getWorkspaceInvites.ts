import { array, InferType, object } from "yup";
import fetchRest from "@/utils/fetchRest";
import { WorkspaceManagedInviteSchema } from "../types";

const GetWorkspaceInvitesOutputSchema = object({
  result: array(WorkspaceManagedInviteSchema.required()).required(),
}).required();

export type GetWorkspaceInvitesOutput = InferType<typeof GetWorkspaceInvitesOutputSchema>;

export const getWorkspaceInvites = async (
  workspaceSlug: string,
): Promise<GetWorkspaceInvitesOutput> => {
  const res = await fetchRest(`/api/v1/workspaces/${workspaceSlug}/invites`, {
    validateSchema: GetWorkspaceInvitesOutputSchema,
  });

  return res as GetWorkspaceInvitesOutput;
};
