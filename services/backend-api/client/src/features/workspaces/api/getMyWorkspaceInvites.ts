import { array, InferType, object } from "yup";
import fetchRest from "@/utils/fetchRest";
import { WorkspaceInviteSchema } from "../types";

const GetMyWorkspaceInvitesOutputSchema = object({
  result: array(WorkspaceInviteSchema.required()).required(),
}).required();

export type GetMyWorkspaceInvitesOutput = InferType<typeof GetMyWorkspaceInvitesOutputSchema>;

export const getMyWorkspaceInvites = async (): Promise<GetMyWorkspaceInvitesOutput> => {
  const res = await fetchRest("/api/v1/workspace-invites/@me", {
    validateSchema: GetMyWorkspaceInvitesOutputSchema,
  });

  return res as GetMyWorkspaceInvitesOutput;
};
