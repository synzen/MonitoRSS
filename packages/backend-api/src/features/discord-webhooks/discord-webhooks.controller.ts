import { Controller, Get, UseGuards } from '@nestjs/common';
import { NestedQuery } from '../../common/decorators/NestedQuery';
import { DiscordOAuth2Guard } from '../../common/guards/DiscordOAuth2.guard';
import { TransformValidationPipe } from '../../common/pipes/TransformValidationPipe';
import { DiscordWebhooksService } from './discord-webhooks.service';
import { GetWebhooksInputDto } from './dto/get-webhooks.input.dto';
import { UserManagesWebhookServerGuard } from './guards/UserManagesWebhookServer.guard';

@Controller('discord-webhooks')
@UseGuards(DiscordOAuth2Guard)
export class DiscordWebhooksController {
  constructor(
    private readonly discordWebhooksService: DiscordWebhooksService,
  ) {}

  @Get()
  @UseGuards(UserManagesWebhookServerGuard)
  async getWebhooks(
    @NestedQuery(TransformValidationPipe)
    getWebhooksInputDto: GetWebhooksInputDto,
  ) {
    console.log(getWebhooksInputDto);
  }
}
