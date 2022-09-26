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
  UseGuards,
} from "@nestjs/common";
import { DiscordOAuth2Guard } from "../discord-auth/guards/DiscordOAuth2.guard";
import { UserManagesFeedServerGuard } from "./guards/UserManagesFeedServer.guard";
import { GetFeedPipe } from "./pipes/GetFeed.pipe";
import { DetailedFeed } from "./types/detailed-feed.type";
import { GetFeedSubscribersOutputDto } from "./dto/GetFeedSubscribersOutput.dto";
import { FeedSubscribersService } from "./feed-subscribers.service";
import { CreateFeedSubscriberOutputDto } from "./dto/CreateFeedSubscriberOutput.dto";
import { TransformValidationPipe } from "../../common/pipes/TransformValidationPipe";
import { CreateFeedSubscriberInputDto } from "./dto/CreateFeedSubscriberInput.dto";
import { GetFeedSubscriberPipe } from "./pipes/GetFeedSubscriber.pipe";
import { FeedSubscriber } from "./entities/feed-subscriber.entity";
import { UpdateFeedSubscriberOutputDto } from "./dto/UpdateFeedSubscriberOutput.dto";
import { UpdateFeedSubscriberInputDto } from "./dto/UpdateFeedSubscriberInput.dto";

@Controller("feeds")
@UseGuards(DiscordOAuth2Guard)
export class FeedSubscribersController {
  constructor(
    private readonly feedSubscribersService: FeedSubscribersService
  ) {}

  @Get(":feedId/subscribers")
  @UseGuards(UserManagesFeedServerGuard)
  async getFeedSubscribers(
    @Param("feedId", GetFeedPipe) feed: DetailedFeed
  ): Promise<GetFeedSubscribersOutputDto> {
    const subscribers = await this.feedSubscribersService.getSubscribersOfFeed(
      feed._id
    );

    return GetFeedSubscribersOutputDto.fromEntity(subscribers);
  }

  @Post(":feedId/subscribers")
  @UseGuards(UserManagesFeedServerGuard)
  async createFeedSubscriber(
    @Param("feedId") feedId: string,
    @Body(TransformValidationPipe) details: CreateFeedSubscriberInputDto
  ): Promise<CreateFeedSubscriberOutputDto> {
    // TODO: Check if the discord role/user is valid
    const updated = await this.feedSubscribersService.createFeedSubscriber({
      type: details.type,
      discordId: details.discordId,
      feedId,
    });

    return CreateFeedSubscriberOutputDto.fromEntity(updated);
  }

  @Patch(":feedId/subscribers/:subscriberId")
  @UseGuards(UserManagesFeedServerGuard)
  async updateOne(
    @Param(GetFeedSubscriberPipe)
    subscriber: FeedSubscriber,
    @Body(TransformValidationPipe)
    details: UpdateFeedSubscriberInputDto
  ): Promise<UpdateFeedSubscriberOutputDto> {
    const updated = await this.feedSubscribersService.updateOne(
      subscriber._id,
      {
        filters: details.filters,
      }
    );

    return UpdateFeedSubscriberOutputDto.fromEntity(updated);
  }

  @Delete(":feedId/subscribers/:subscriberId")
  @UseGuards(UserManagesFeedServerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeFeedSubscriber(
    @Param(GetFeedSubscriberPipe)
    subscriber: FeedSubscriber
  ) {
    await this.feedSubscribersService.remove(subscriber._id);
  }
}
