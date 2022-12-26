import {
  Inject,
  Injectable,
  NotFoundException,
  PipeTransform,
  Scope,
  UnauthorizedException,
} from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { Types } from "mongoose";
import { UserFeedsService } from "../user-feeds.service";
import { FastifyRequest } from "fastify";
import { getAccessTokenFromRequest } from "../../discord-auth/utils/get-access-token-from-session";

@Injectable({
  scope: Scope.REQUEST,
})
export class GetUserFeedPipe implements PipeTransform {
  constructor(
    private readonly userFeedsService: UserFeedsService,
    @Inject(REQUEST)
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

    if (!found || found.user.discordUserId !== accessToken.discord.id) {
      throw new NotFoundException(`Feed ${feedId} not found`);
    }

    return found;
  }
}
