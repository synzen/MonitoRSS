import { InferType, object, string } from "yup";
import fetchRest from "@/utils/fetchRest";

const AcceptWorkspaceInviteOutputSchema = object({
  result: object({
    workspaceSlug: string().required(),
  }).required(),
}).required();

export type AcceptWorkspaceInviteOutput = InferType<typeof AcceptWorkspaceInviteOutputSchema>;

export const acceptWorkspaceInvite = async (
  inviteId: string,
): Promise<AcceptWorkspaceInviteOutput> => {
  const res = await fetchRest(`/api/v1/workspace-invites/${inviteId}/accept`, {
    requestOptions: {
      method: "POST",
      body: JSON.stringify({}),
    },
    validateSchema: AcceptWorkspaceInviteOutputSchema,
  });

  return res as AcceptWorkspaceInviteOutput;
};
