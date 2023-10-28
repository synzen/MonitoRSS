import { InferType, object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { UserMeSchema } from "../types";

export interface GetUserMeInput {
  data?: {
    includeManageSubUrls: boolean;
  };
}
const GetUserMeOutputSchema = object({
  result: UserMeSchema,
});

export type GetUserMeOutput = InferType<typeof GetUserMeOutputSchema>;

export const getUserMe = async (input?: GetUserMeInput): Promise<GetUserMeOutput> => {
  const params = new URLSearchParams();

  if (input?.data?.includeManageSubUrls) {
    params.set("includeManageSubUrls", "true");
  }

  const res = await fetchRest(`/api/v1/users/@me?${params.toString()}`, {
    validateSchema: GetUserMeOutputSchema,
  });

  return res as GetUserMeOutput;
};
