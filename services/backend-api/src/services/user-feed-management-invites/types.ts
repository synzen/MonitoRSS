import type {
  IUserFeed,
  IUserFeedRepository,
} from "../../repositories/interfaces/user-feed.types";
import type {
  UserFeedManagerInviteType,
  UserFeedManagerStatus,
} from "../../repositories/shared/enums";
import type { SupportersService } from "../supporters/supporters.service";
import type { UserFeedsService } from "../user-feeds/user-feeds.service";

export interface UserFeedManagementInvitesServiceDeps {
  userFeedRepository: IUserFeedRepository;
  userFeedsService: UserFeedsService;
  supportersService: SupportersService;
}

export interface CreateInviteInput {
  feed: IUserFeed;
  targetDiscordUserId: string;
  type: UserFeedManagerInviteType;
  connections?: Array<{ connectionId: string }>;
}

export interface UpdateInviteInput {
  status?: UserFeedManagerStatus;
  connections?: Array<{ connectionId: string }> | null;
}

export interface PendingInviteResult {
  id: string;
  type?: UserFeedManagerInviteType;
  feed: {
    id: string;
    title: string;
    url: string;
    ownerDiscordUserId: string;
  };
}
