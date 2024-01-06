import { UserFeed } from "../entities";

export type UserFeedConnection =
  UserFeed["connections"][keyof UserFeed["connections"]][number];
