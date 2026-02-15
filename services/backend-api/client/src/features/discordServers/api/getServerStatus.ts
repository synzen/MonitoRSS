import { boolean, InferType, object } from "yup";
import fetchRest from "../../../utils/fetchRest";

export interface GetServerStatusInput {
  serverId: string;
}

const GetServerStatusOutputSchema = object({
  result: object({
    authorized: boolean().required(),
  }),
});

export type GetServerStatusOutput = InferType<typeof GetServerStatusOutputSchema>;

export const getServerStatus = async (
  options: GetServerStatusInput,
): Promise<GetServerStatusOutput> => {
  const res = await fetchRest(`/api/v1/discord-servers/${options.serverId}/status`, {
    validateSchema: GetServerStatusOutputSchema,
  });

  return res as GetServerStatusOutput;
};
