import {
  forwardRef,
  Inject,
  mixin,
  NotFoundException,
  PipeTransform,
  Type,
  UnauthorizedException,
} from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { Types } from "mongoose";
import { FastifyRequest } from "fastify";
import { getAccessTokenFromRequest } from "../../discord-auth/utils/get-access-token-from-session";
import { memoize } from "lodash";
import { NoPermissionException } from "../exceptions";
import {
  UserFeedManagerStatus,
  UserFeedManagerType,
} from "../../user-feed-management-invites/constants";
import { InjectModel } from "@nestjs/mongoose";
import { UserFeed, UserFeedModel } from "../entities";
import { ConfigService } from "@nestjs/config";

interface PipeOptions {
  userTypes: UserFeedManagerType[];
}

const createGetUserFeedPipe = (
  data: PipeOptions = {
    userTypes: [UserFeedManagerType.Creator, UserFeedManagerType.SharedManager],
  }
): Type<PipeTransform> => {
  class GetUserFeedPipe implements PipeTransform {
    constructor(
      @InjectModel(UserFeed.name)
      private readonly userFeedModel: UserFeedModel,
      @Inject(forwardRef(() => REQUEST))
      private readonly request: FastifyRequest,
      private readonly configService: ConfigService
    ) {}

    async transform(feedId: string): Promise<UserFeed> {
      if (!Types.ObjectId.isValid(feedId)) {
        throw new NotFoundException("Feed not found. Invalid Object Id.");
      }

      const accessToken = getAccessTokenFromRequest(this.request);

      if (!accessToken) {
        throw new UnauthorizedException();
      }

      const found = await this.userFeedModel.findById(feedId).lean();

      const allowOwner =
        data.userTypes.includes(UserFeedManagerType.Creator) &&
        found?.user.discordUserId === accessToken.discord.id;

      const isSharedManager = found?.shareManageOptions?.invites?.some(
        (u) =>
          u.discordUserId === accessToken.discord.id &&
          u.status === UserFeedManagerStatus.Accepted
      );

      const allowSharedManager =
        data.userTypes.includes(UserFeedManagerType.SharedManager) &&
        isSharedManager;

      if (isSharedManager && !allowSharedManager) {
        throw new NoPermissionException();
      }

      if (!found || (!allowOwner && !allowSharedManager)) {
        throw new NotFoundException(`Feed ${feedId} not found`);
      }

      return {
        ...found,
        allowLegacyReversion:
          !!this.configService.get("BACKEND_API_ALLOW_LEGACY_REVERSION") ||
          found.allowLegacyReversion,
      };
    }
  }

  return mixin(GetUserFeedPipe);
};

export const GetUserFeedPipe: (data?: PipeOptions) => Type<PipeTransform> =
  memoize(createGetUserFeedPipe);
