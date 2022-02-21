import { Controller, Get, Query, Res, Session } from '@nestjs/common';
import { DiscordAuthService } from './discord-auth.service';
import { FastifyReply } from 'fastify';
import { Session as FastifySession } from 'fastify-secure-session';

@Controller('discord')
export class DiscordAuthController {
  constructor(private readonly discordAuthService: DiscordAuthService) {}

  @Get('login')
  login(@Res() res: FastifyReply) {
    const authorizationUri = this.discordAuthService.getAuthorizationUrl();

    res.redirect(301, authorizationUri);
  }

  @Get('callback')
  async discordCallback(
    @Res({ passthrough: true }) res: FastifyReply,
    @Session() session: FastifySession,
    @Query('code') code?: string,
    @Query('error') error?: string,
  ) {
    if (error === 'access_denied') {
      return res.redirect(301, '/');
    }

    if (!code) {
      return 'No code provided';
    }

    const accessToken = await this.discordAuthService.createAccessToken(code);
    session.set('accessToken', accessToken);

    return accessToken;
  }
}
