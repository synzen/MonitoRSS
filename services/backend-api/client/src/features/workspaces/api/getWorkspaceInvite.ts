import { InferType, object } from "yup";
import fetchRest from "@/utils/fetchRest";
import { WorkspaceInviteContextSchema } from "../types";

const GetWorkspaceInviteOutputSchema = object({
  result: WorkspaceInviteContextSchema,
}).required();

export type GetWorkspaceInviteOutput = InferType<typeof GetWorkspaceInviteOutputSchema>;

export const getWorkspaceInvite = async (inviteId: string): Promise<GetWorkspaceInviteOutput> => {
  const res = await fetchRest(`/api/v1/workspace-invites/${inviteId}`, {
    validateSchema: GetWorkspaceInviteOutputSchema,
  });

  return res as GetWorkspaceInviteOutput;
};
