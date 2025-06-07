import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from "@nestjs/common";
import { DiscordAccessToken } from "../discord-auth/decorators/DiscordAccessToken";
import { DiscordOAuth2Guard } from "../discord-auth/guards/DiscordOAuth2.guard";
import { SessionAccessToken } from "../discord-auth/types/SessionAccessToken.type";
import { UsersService } from "../users/users.service";
import {
  GetUserFeedTagsOutputDto,
  GetUserFeedTagOutputDto,
  CreateUserFeedTagInputDto,
  UpdateUserFeedTagInputDto,
} from "./dto";
import { UserFeedTagsService } from "./user-feed-tags.service";

@Controller("user-feed-tags")
@UseGuards(DiscordOAuth2Guard)
export class UserFeedTagsController {
  constructor(
    private readonly userFeedTagsService: UserFeedTagsService,
    private readonly usersService: UsersService
  ) {}

  @Get()
  async getUserFeedTags(
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken
  ): Promise<GetUserFeedTagsOutputDto> {
    const { _id: userId } = await this.usersService.getOrCreateUserByDiscordId(
      discordUserId
    );

    const tags = await this.userFeedTagsService.getUserFeedTags(userId);

    return this.userFeedTagsService.formatForHttpResponse(tags);
  }

  @Post()
  async createUserFeedTag(
    @Body(ValidationPipe) dto: CreateUserFeedTagInputDto,
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken
  ): Promise<GetUserFeedTagOutputDto> {
    const { _id: userId } = await this.usersService.getOrCreateUserByDiscordId(
      discordUserId
    );

    const tag = await this.userFeedTagsService.createUserFeedTag(userId, dto);

    return this.userFeedTagsService.formatSingleForHttpResponse(tag);
  }

  @Patch(":id")
  async updateUserFeedTag(
    @Param("id") tagId: string,
    @Body(ValidationPipe) dto: UpdateUserFeedTagInputDto,
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken
  ): Promise<GetUserFeedTagOutputDto> {
    const { _id: userId } = await this.usersService.getOrCreateUserByDiscordId(
      discordUserId
    );

    const updatedTag = await this.userFeedTagsService.updateUserFeedTag(
      userId,
      tagId,
      dto
    );

    if (!updatedTag) {
      throw new NotFoundException("Tag not found");
    }

    return this.userFeedTagsService.formatSingleForHttpResponse(updatedTag);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUserFeedTag(
    @Param("id") tagId: string,
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken
  ): Promise<void> {
    const { _id: userId } = await this.usersService.getOrCreateUserByDiscordId(
      discordUserId
    );

    const deletedCount = await this.userFeedTagsService.deleteUserFeedTag(
      userId,
      tagId
    );

    if (deletedCount === 0) {
      throw new NotFoundException("Tag not found");
    }
  }
}
