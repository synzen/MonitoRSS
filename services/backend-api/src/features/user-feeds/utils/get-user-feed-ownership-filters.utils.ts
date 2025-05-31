import { UserFeedManagerStatus } from "../../user-feed-management-invites/constants";

export function generateUserFeedOwnershipFilters(discordUserId: string) {
  return {
    $or: [
      {
        "user.discordUserId": discordUserId,
      },
      {
        "shareManageOptions.invites": {
          $elemMatch: {
            discordUserId: discordUserId,
            status: UserFeedManagerStatus.Accepted,
          },
        },
      },
    ],
  };
}
