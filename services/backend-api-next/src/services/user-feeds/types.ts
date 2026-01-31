import type { Config } from "../../config";
import type {
  IUserFeed,
  IUserFeedRepository,
  IUserFeedFormatOptions,
  IUserFeedDateCheckOptions,
  IExternalFeedProperty,
} from "../../repositories/interfaces/user-feed.types";
import type {
  GetArticlesResponseRequestStatus,
  GetArticlesResponse,
  GetFeedArticlesFilterReturnType,
  CustomPlaceholder,
} from "../feed-handler/types";
import type { IUserRepository } from "../../repositories/interfaces/user.types";
import type { UserFeedDisabledCode } from "../../repositories/shared/enums";
import type { FeedsService } from "../feeds/feeds.service";
import type { FeedFetcherApiService } from "../feed-fetcher-api/feed-fetcher-api.service";
import type { FeedFetcherService } from "../feed-fetcher";
import type { FeedHandlerService } from "../feed-handler/feed-handler.service";
import type { SupportersService } from "../supporters/supporters.service";
import type { UsersService } from "../users/users.service";

import type { IDiscordChannelConnection } from "../../repositories/interfaces/feed-connection.types";
import type {
  CreateDiscordChannelConnectionInput,
  UpdateDiscordChannelConnectionInput,
  CloneConnectionInput,
  CopySettingsInput,
} from "../feed-connections-discord-channels/types";

export interface IFeedConnectionsDiscordChannelsService {
  deleteConnection(feedId: string, connectionId: string): Promise<void>;
  createDiscordChannelConnection(
    input: CreateDiscordChannelConnectionInput,
  ): Promise<IDiscordChannelConnection>;
  updateDiscordChannelConnection(
    feedId: string,
    connectionId: string,
    input: UpdateDiscordChannelConnectionInput,
  ): Promise<IDiscordChannelConnection>;
  cloneConnection(
    connection: IDiscordChannelConnection,
    input: CloneConnectionInput,
    userAccessToken: string,
    userDiscordUserId: string,
  ): Promise<{ ids: string[] }>;
  copySettings(
    userFeed: IUserFeed,
    sourceConnection: IDiscordChannelConnection,
    input: CopySettingsInput,
  ): Promise<void>;
}

export interface UserFeedsServiceDeps {
  config: Config;
  userFeedRepository: IUserFeedRepository;
  userRepository: IUserRepository;
  feedsService: FeedsService;
  supportersService: SupportersService;
  feedFetcherApiService: FeedFetcherApiService;
  feedFetcherService: FeedFetcherService;
  feedHandlerService: FeedHandlerService;
  usersService: UsersService;
  publishMessage: (queue: string, message: unknown) => Promise<void>;
  feedConnectionsDiscordChannelsService?: IFeedConnectionsDiscordChannelsService;
}

export interface UpdateFeedInput {
  title?: string;
  url?: string;
  disabledCode?: UserFeedDisabledCode | null;
  passingComparisons?: string[];
  blockingComparisons?: string[];
  formatOptions?: Partial<IUserFeedFormatOptions>;
  dateCheckOptions?: Partial<IUserFeedDateCheckOptions>;
  shareManageOptions?: {
    invites: Array<{ discordUserId: string }>;
  };
  userRefreshRateSeconds?: number | null;
  externalProperties?: IExternalFeedProperty[];
}

export enum GetUserFeedsInputSortKey {
  CreatedAtAscending = "createdAt",
  CreatedAtDescending = "-createdAt",
  TitleAscending = "title",
  TitleDescending = "-title",
  UrlAscending = "url",
  UrlDescending = "-url",
  ComputedStatusAscending = "computedStatus",
  ComputedStatusDescending = "-computedStatus",
  OwnedByUserAscending = "ownedByUser",
  OwnedByUserDescending = "-ownedByUser",
  RefreshRateAscending = "refreshRateSeconds",
  RefreshRateDescending = "-refreshRateSeconds",
}

export enum UserFeedComputedStatus {
  Ok = "ok",
  RequiresAttention = "requires-attention",
  ManuallyDisabled = "manually-disabled",
  Retrying = "retrying",
}

export interface GetUserFeedsInputFilters {
  disabledCodes?: (UserFeedDisabledCode | null)[];
  connectionDisabledCodes?: (string | null)[];
  computedStatuses?: UserFeedComputedStatus[];
  ownedByUser?: boolean;
  userTagIds?: string[];
}

export interface GetUserFeedsInput {
  limit?: number;
  offset?: number;
  search?: string;
  sort?: GetUserFeedsInputSortKey;
  filters?: GetUserFeedsInputFilters;
}

export interface UserFeedListItem {
  id: string;
  title: string;
  url: string;
  inputUrl?: string;
  healthStatus: string;
  disabledCode?: UserFeedDisabledCode;
  createdAt: Date;
  computedStatus: UserFeedComputedStatus;
  legacyFeedId?: string;
  ownedByUser: boolean;
  refreshRateSeconds?: number;
}

export interface CreateUserFeedInput {
  title?: string;
  url: string;
  sourceFeedId?: string;
}

export interface ValidateFeedUrlOutput {
  resolvedToUrl: string | null;
  feedTitle?: string;
}

export interface CheckUrlIsValidOutput {
  finalUrl: string;
  enableDateChecks: boolean;
  feedTitle?: string;
}

export interface GetFeedArticlePropertiesInput {
  feed: IUserFeed;
  url: string;
  customPlaceholders?: CustomPlaceholder[] | null;
}

export interface GetFeedArticlePropertiesOutput {
  properties: string[];
  requestStatus: GetArticlesResponseRequestStatus;
}

export interface GetFeedArticlesInput {
  feed: IUserFeed;
  limit: number;
  url: string;
  random?: boolean;
  selectProperties?: string[];
  selectPropertyTypes?: string[];
  skip?: number;
  discordUserId: string;
  includeHtmlInErrors?: boolean;
  filters?: {
    returnType: GetFeedArticlesFilterReturnType.IncludeEvaluationResults;
    expression?: Record<string, unknown>;
    search?: string;
  };
  formatter: {
    customPlaceholders?: CustomPlaceholder[] | null;
    externalProperties?: Array<{
      sourceField: string;
      label: string;
      cssSelector: string;
    }> | null;
    options: {
      stripImages: boolean;
      formatTables: boolean;
      dateFormat: string | undefined;
      dateTimezone: string | undefined;
      dateLocale: string | undefined;
      disableImageLinkPreviews: boolean;
    };
  };
}

export type GetFeedArticlesOutput = GetArticlesResponse["result"];
