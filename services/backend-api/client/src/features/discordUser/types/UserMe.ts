import { InferType, bool, object, string } from "yup";

export const UserMeSchema = object({
  id: string().required(),
  email: string(),
  preferences: object({
    alertOnDisabledFeeds: bool().default(false),
  }).default({}),
});

export type UserMe = InferType<typeof UserMeSchema>;
