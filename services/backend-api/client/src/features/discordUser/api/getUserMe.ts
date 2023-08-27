import { InferType, object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { UserMeSchema } from "../types";

const GetUserMeOutputSchema = object({
  result: UserMeSchema,
});

export type GetUserMeOutput = InferType<typeof GetUserMeOutputSchema>;

export const getUserMe = async (): Promise<GetUserMeOutput> => {
  const res = await fetchRest(`/api/v1/users/@me`, {
    validateSchema: GetUserMeOutputSchema,
  });

  return res as GetUserMeOutput;
};
