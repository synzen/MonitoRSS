import { array, InferType, object } from "yup";
import fetchRest from "@/utils/fetchRest";
import { WorkspaceSchema } from "../types";

const GetWorkspacesOutputSchema = object({
  result: array(WorkspaceSchema.required()).required(),
}).required();

export type GetWorkspacesOutput = InferType<typeof GetWorkspacesOutputSchema>;

export const getWorkspaces = async (): Promise<GetWorkspacesOutput> => {
  const res = await fetchRest("/api/v1/workspaces", {
    validateSchema: GetWorkspacesOutputSchema,
  });

  return res as GetWorkspacesOutput;
};
