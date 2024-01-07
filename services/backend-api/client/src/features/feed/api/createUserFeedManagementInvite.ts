import { InferType, object, string } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { UserFeedManagerInviteType } from "../../../constants";

export interface CreateUserFeedManagementInviteInput {
  data: {
    feedId: string;
    discordUserId: string;
    type: UserFeedManagerInviteType;
    connections: Array<{ connectionId: string }>;
  };
}

const CreateUserFeedManagementInviteOutputSchema = object({
  result: object({
    status: string().required(),
  }),
}).required();

export type CreateUserFeedManagementInviteOutput = InferType<
  typeof CreateUserFeedManagementInviteOutputSchema
>;

export const createUserFeedManagementInvite = async (
  options: CreateUserFeedManagementInviteInput
): Promise<CreateUserFeedManagementInviteOutput> => {
  const res = await fetchRest(`/api/v1/user-feed-management-invites`, {
    validateSchema: CreateUserFeedManagementInviteOutputSchema,
    requestOptions: {
      method: "POST",
      body: JSON.stringify(options.data),
    },
  });

  return res as CreateUserFeedManagementInviteOutput;
};
