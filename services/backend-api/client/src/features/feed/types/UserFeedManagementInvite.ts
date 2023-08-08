import { InferType, object, string } from "yup";
import { UserFeedManagerInviteType } from "../../../constants";

export const UserFeedManagementInviteSchema = object({
  id: string().required(),
  feed: object({
    id: string().required(),
    title: string().required(),
    url: string().required(),
    ownerDiscordUserId: string().required(),
  }).required(),
  type: string().oneOf(Object.values(UserFeedManagerInviteType)).optional().nullable(),
});

export type UserFeedManagementInvite = InferType<typeof UserFeedManagementInviteSchema>;
