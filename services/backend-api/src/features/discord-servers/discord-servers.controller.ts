/* eslint-disable max-len */
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
} from "@nestjs/common";
import { NestedQuery } from "../../common/decorators/NestedQuery";
import { DiscordOAuth2Guard } from "../discord-auth/guards/DiscordOAuth2.guard";
import { TransformValidationPipe } from "../../common/pipes/TransformValidationPipe";
import { DiscordServersService } from "./discord-servers.service";
import { GetServerFeedsInputDto } from "./dto/GetServerFeedsInput.dto";
import { GetServerFeedsOutputDto } from "./dto/GetServerFeedsOutput.dto";
import { BotHasServerGuard } from "./guards/BotHasServer.guard";
import { UserManagesServerGuard } from "./guards/UserManagesServer.guard";
import { GetServerChannelsOutputDto } from "./dto/GetServerChannelsOutput.dto";
import { HttpCacheInterceptor } from "../../common/interceptors/http-cache-interceptor";
import { GetServerRolesOutputDto } from "./dto/GetServerRolesOutput.dto";
import { GetServerStatusOutputDto } from "./dto/GetServerStatusOutput.dto";
import { GetServerOutputDto } from "./dto/GetServerOutput.dto";
import { UpdateServerOutputDto } from "./dto/UpdateServerOutput.dto";
import { UpdateServerInputDto } from "./dto/UpdateServerInput.dto";
import { GetDiscordServerChannelsFilter } from "./filters";
import { GetServerActiveThreadsInputDto } from "./dto/GetServerActiveThreadsInput.dto";
import { GetServerMembersInputDto } from "./dto/GetServerMembersInput.dto";
import { GetServerMembersOutputDto } from "./dto/GetServerMembersOutput.dto";
import { GetServerMemberOutputDto } from "./dto/GetServerMemberOutput.dto";
import { FeedsService } from "../feeds/feeds.service";
import { LegacyFeedConversionService } from "../legacy-feed-conversion/legacy-feed-conversion.service";
import { DiscordAccessToken } from "../discord-auth/decorators/DiscordAccessToken";
import { SessionAccessToken } from "../discord-auth/types/SessionAccessToken.type";
import { ConvertServerLegacyFeedsFilter } from "./filters/convert-server-legacy-feeds.filter";
import { CacheTTL } from "@nestjs/cache-manager";

@Controller("discord-servers")
@UseGuards(DiscordOAuth2Guard)
export class DiscordServersController {
  constructor(
    private readonly discordServersService: DiscordServersService,
    private readonly feedsService: FeedsService,
    private readonly legacyFeedConversionService: LegacyFeedConversionService
  ) {}

  @Get(":serverId")
  @UseGuards(BotHasServerGuard)
  @UseGuards(UserManagesServerGuard)
  async getServer(@Param("serverId") serverId: string): Promise<
    GetServerOutputDto & {
      result: {
        includesBot: boolean;
      };
    }
  > {
    const [profile, { exists }] = await Promise.all([
      this.discordServersService.getServerProfile(serverId),
      this.discordServersService.getGuild(serverId),
    ]);

    return {
      result: {
        profile,
        includesBot: exists,
      },
    };
  }

  @Post(":serverId/legacy-conversion")
  @UseGuards(BotHasServerGuard)
  @UseGuards(UserManagesServerGuard)
  @UseFilters(ConvertServerLegacyFeedsFilter)
  async createLegacyConversion(
    @Param("serverId") serverId: string,
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken
  ) {
    return this.legacyFeedConversionService.createBulkConversionJob(
      discordUserId,
      serverId
    );
  }

  @Get(":serverId/legacy-conversion")
  @UseGuards(BotHasServerGuard)
  @UseGuards(UserManagesServerGuard)
  @UseFilters(ConvertServerLegacyFeedsFilter)
  async getLegacyConversionStatus(
    @Param("serverId") serverId: string,
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken
  ) {
    return this.legacyFeedConversionService.getBulkConversionJobStatus(
      discordUserId,
      serverId
    );
  }

  @Get(":serverId/backup")
  @UseGuards(BotHasServerGuard)
  @UseGuards(UserManagesServerGuard)
  async getBackup(
    @Param("serverId") serverId: string
  ): Promise<StreamableFile> {
    const backupJson = await this.discordServersService.createBackup(serverId);

    const buffer = Buffer.from(JSON.stringify(backupJson, null, 2));

    return new StreamableFile(buffer);
  }

  @Get(":serverId/active-threads")
  @UseGuards(BotHasServerGuard)
  @UseGuards(UserManagesServerGuard)
  async getActiveThreads(
    @Param("serverId") serverId: string,
    @NestedQuery(TransformValidationPipe)
    { parentChannelId }: GetServerActiveThreadsInputDto
  ): Promise<GetServerChannelsOutputDto> {
    const channels = await this.discordServersService.getActiveThreads(
      serverId,
      {
        parentChannelId,
      }
    );

    return GetServerChannelsOutputDto.fromEntities(channels);
  }

  @Patch(":serverId")
  @UseGuards(BotHasServerGuard)
  @UseGuards(UserManagesServerGuard)
  async updateServer(
    @Param("serverId") serverId: string,
    @Body(ValidationPipe) updateServerInputDto: UpdateServerInputDto
  ): Promise<UpdateServerOutputDto> {
    const profile = await this.discordServersService.updateServerProfile(
      serverId,
      updateServerInputDto
    );

    return {
      result: {
        profile,
      },
    };
  }

  @Get(":serverId/status")
  @UseGuards(UserManagesServerGuard)
  async getServerStatus(
    @Param("serverId") serverId: string
  ): Promise<GetServerStatusOutputDto> {
    const result = await this.discordServersService.getServer(serverId);

    return {
      result: {
        authorized: !!result,
      },
    };
  }

  @Get(":serverId/legacy-feed-count")
  @UseGuards(BotHasServerGuard)
  @UseGuards(UserManagesServerGuard)
  async getServerLegacyFeedCount(@Param("serverId") serverId: string) {
    const total = await this.feedsService.countLegacyServerFeeds(serverId);

    return {
      result: {
        total,
      },
    };
  }

  @Get(":serverId/feeds")
  @UseGuards(BotHasServerGuard)
  @UseGuards(UserManagesServerGuard)
  async getServerFeeds(
    @Param("serverId") serverId: string,
    @NestedQuery(TransformValidationPipe)
    getServerFeedsInput: GetServerFeedsInputDto
  ): Promise<GetServerFeedsOutputDto> {
    const [serverFeeds, totalFeeds] = await Promise.all([
      this.discordServersService.getServerFeeds(serverId, {
        search: getServerFeedsInput.search,
        limit: getServerFeedsInput.limit,
        offset: getServerFeedsInput.offset,
      }),
      this.discordServersService.countServerFeeds(serverId, {
        search: getServerFeedsInput.search,
      }),
    ]);

    return {
      results: serverFeeds.map((feed) => ({
        id: feed._id.toHexString(),
        channel: feed.channel,
        createdAt: feed.addedAt?.toISOString(),
        status: feed.status,
        title: feed.title,
        url: feed.url,
      })),
      total: totalFeeds,
    };
  }

  @Get(":serverId/channels")
  @UseGuards(UserManagesServerGuard)
  @UseInterceptors(HttpCacheInterceptor)
  @UseFilters(GetDiscordServerChannelsFilter)
  @CacheTTL(1)
  async getServerChannels(
    @Param("serverId") serverId: string,
    @Query("types") types?: string
  ): Promise<GetServerChannelsOutputDto> {
    const channels = await this.discordServersService.getTextChannelsOfServer(
      serverId,
      {
        types: types?.split(","),
      }
    );

    return GetServerChannelsOutputDto.fromEntities(channels);
  }

  @Get(":serverId/roles")
  @UseGuards(BotHasServerGuard)
  @UseGuards(UserManagesServerGuard)
  @UseInterceptors(HttpCacheInterceptor)
  @CacheTTL(60 * 5)
  async getServerRoles(
    @Param("serverId") serverId: string
  ): Promise<GetServerRolesOutputDto> {
    const roles = await this.discordServersService.getRolesOfServer(serverId);

    return GetServerRolesOutputDto.fromEntities(roles);
  }

  @Get(":serverId/members/:memberId")
  @UseGuards(BotHasServerGuard)
  @UseGuards(UserManagesServerGuard)
  async getServerMember(
    @Param("serverId") serverId: string,
    @Param("memberId") memberId: string
  ): Promise<GetServerMemberOutputDto | null> {
    const member = await this.discordServersService.getMemberOfServer(
      serverId,
      memberId
    );

    if (!member) {
      return null;
    }

    return GetServerMemberOutputDto.fromEntity(member);
  }

  @Get(":serverId/members")
  @UseGuards(BotHasServerGuard)
  @UseGuards(UserManagesServerGuard)
  async getServerMembers(
    @Param("serverId") serverId: string,
    @NestedQuery(ValidationPipe) { limit, search }: GetServerMembersInputDto
  ) {
    const res = await this.discordServersService.searchMembersOfServer(
      serverId,
      {
        limit,
        search,
      }
    );

    return GetServerMembersOutputDto.fromEntities(res);
  }
}
