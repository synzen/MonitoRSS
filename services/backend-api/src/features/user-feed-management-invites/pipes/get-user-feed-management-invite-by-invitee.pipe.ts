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
import { UserFeedManagementInvitesService } from "../user-feed-management-invites.service";

const create = (): Type<PipeTransform> => {
  class Pipe implements PipeTransform {
    constructor(
      @Inject(forwardRef(() => UserFeedManagementInvitesService))
      private readonly service: UserFeedManagementInvitesService,
      @Inject(forwardRef(() => REQUEST))
      private readonly request: FastifyRequest
    ) {}

    async transform(id: string) {
      if (!Types.ObjectId.isValid(id)) {
        throw new NotFoundException("Feed not found. Invalid Object Id.");
      }

      const accessToken = getAccessTokenFromRequest(this.request);

      if (!accessToken) {
        throw new UnauthorizedException();
      }

      const found = await this.service.getUserFeedOfInviteWithInvitee(
        id,
        accessToken.discord.id
      );

      if (!found) {
        throw new NotFoundException(`Invite ${id} not found`);
      }

      return found;
    }
  }

  return mixin(Pipe);
};

export const GetUserFeedManagementInviteByInviteePipe: () => Type<PipeTransform> =
  memoize(create);
