import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseFilters,
  UseGuards,
  ValidationPipe,
} from "@nestjs/common";
import { DiscordOAuth2Guard } from "../discord-auth/guards/DiscordOAuth2.guard";
import { UserFeed } from "../user-feeds/entities";
import { GetUserFeedsPipe } from "../user-feeds/pipes";
import { UserFeedManagerType } from "./constants";
import {
  GetUserFeedManagementInviteByInviteePipe,
  GetUserFeedManagementInviteByOwnerPipe,
} from "./pipes";
import {
  CreateUserFeedManagementInviteInputDto,
  UpdateUserFeedManagementInviteInputDto,
} from "./dto";
import { UserFeedManagementInvitesService } from "./user-feed-management-invites.service";
import { DiscordAccessToken } from "../discord-auth/decorators/DiscordAccessToken";
import { SessionAccessToken } from "../discord-auth/types/SessionAccessToken.type";
import { FeedExceptionFilter } from "../feeds/filters";
import { CreateUserFeedManagementInviteExceptionFilter } from "./filters";

@Controller("user-feed-management-invites")
@UseGuards(DiscordOAuth2Guard)
export class UserFeedManagementInvitesController {
  constructor(private readonly service: UserFeedManagementInvitesService) {}

  @Get()
  async getMyInvites(
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken
  ) {
    const results = await this.service.getMyPendingInvites(discordUserId);

    return {
      results,
    };
  }

  @Get("pending")
  async getMyInviteCount(
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken
  ) {
    const total = await this.service.getMyPendingInviteCount(discordUserId);

    return {
      total,
    };
  }

  @Post(":id/resend")
  @HttpCode(HttpStatus.NO_CONTENT)
  async resendInvite(
    @Param("id") inviteId: string,
    @Param("id", GetUserFeedManagementInviteByOwnerPipe()) userFeed: UserFeed
  ) {
    await this.service.resendInvite(userFeed._id, inviteId);
  }

  @Post()
  @UseFilters(CreateUserFeedManagementInviteExceptionFilter)
  async createInvite(
    @Body(
      "feedId",
      GetUserFeedsPipe({
        userTypes: [UserFeedManagerType.Creator],
      })
    )
    [feed]: UserFeed[],
    @Body(ValidationPipe)
    {
      discordUserId: targetDiscordUserId,
      type,
      connections,
    }: CreateUserFeedManagementInviteInputDto
  ) {
    await this.service.createInvite({
      feed,
      targetDiscordUserId,
      type,
      connections,
    });

    return {
      result: {
        status: "SUCCESS",
      },
    };
  }

  @Patch(":id/status")
  @UseFilters(FeedExceptionFilter)
  async updateInvite(
    @Param("id") inviteId: string,
    @Param("id", GetUserFeedManagementInviteByInviteePipe()) userFeed: UserFeed,
    @Body(ValidationPipe) { status }: UpdateUserFeedManagementInviteInputDto
  ) {
    await this.service.updateInvite(userFeed, inviteId, {
      status,
    });

    return {
      result: {
        status: "SUCCESS",
      },
    };
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteInvite(
    @Param("id") inviteId: string,
    @Param("id", GetUserFeedManagementInviteByOwnerPipe()) userFeed: UserFeed
  ) {
    await this.service.deleteInvite(userFeed._id, inviteId);
  }
}
