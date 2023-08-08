import { InferType, object, string } from "yup";

export const UserFeedManagementInviteSchema = object({
  id: string().required(),
  feed: object({
    id: string().required(),
    title: string().required(),
    url: string().required(),
    ownerDiscordUserId: string().required(),
  }).required(),
});

export type UserFeedManagementInvite = InferType<typeof UserFeedManagementInviteSchema>;
