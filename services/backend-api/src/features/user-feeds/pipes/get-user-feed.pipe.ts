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
import { UserFeedsService } from "../user-feeds.service";
import { FastifyRequest } from "fastify";
import { getAccessTokenFromRequest } from "../../discord-auth/utils/get-access-token-from-session";
import { UserFeedManagerType } from "../constants/user-feed-manager-type.types";
import { memoize } from "lodash";
import { NoPermissionException } from "../exceptions";

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
      @Inject(forwardRef(() => UserFeedsService))
      private readonly userFeedsService: UserFeedsService,
      @Inject(forwardRef(() => REQUEST))
      private readonly request: FastifyRequest
    ) {}

    async transform(feedId: string) {
      if (!Types.ObjectId.isValid(feedId)) {
        throw new NotFoundException("Feed not found. Invalid Object Id.");
      }

      const accessToken = getAccessTokenFromRequest(this.request);

      if (!accessToken) {
        throw new UnauthorizedException();
      }

      const found = await this.userFeedsService.getFeedById(feedId);

      const allowOwner =
        data.userTypes.includes(UserFeedManagerType.Creator) &&
        found?.user.discordUserId === accessToken.discord.id;

      const isSharedManager = found?.shareManageOptions?.users?.some(
        (u) => u.discordUserId === accessToken.discord.id
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

      return found;
    }
  }

  return mixin(GetUserFeedPipe);
};

export const GetUserFeedPipe: (data?: PipeOptions) => Type<PipeTransform> =
  memoize(createGetUserFeedPipe);
