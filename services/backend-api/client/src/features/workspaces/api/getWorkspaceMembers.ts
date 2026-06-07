import { array, InferType, object } from "yup";
import fetchRest from "@/utils/fetchRest";
import { WorkspaceMemberSchema } from "../types";

const GetWorkspaceMembersOutputSchema = object({
  result: array(WorkspaceMemberSchema.required()).required(),
}).required();

export type GetWorkspaceMembersOutput = InferType<typeof GetWorkspaceMembersOutputSchema>;

export const getWorkspaceMembers = async (
  workspaceSlug: string,
): Promise<GetWorkspaceMembersOutput> => {
  const res = await fetchRest(`/api/v1/workspaces/${workspaceSlug}/members`, {
    validateSchema: GetWorkspaceMembersOutputSchema,
  });

  return res as GetWorkspaceMembersOutput;
};
