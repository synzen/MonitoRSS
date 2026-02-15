import { UserFeedManagerStatus } from "../../../repositories/shared/enums";

export function generateUserFeedOwnershipFilters(discordUserId: string) {
  return {
    $or: [
      { "user.discordUserId": discordUserId },
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
