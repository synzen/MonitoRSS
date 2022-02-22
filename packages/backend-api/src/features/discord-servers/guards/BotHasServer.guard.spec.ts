import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { DiscordServersService } from '../discord-servers.service';
import { BotHasServerGuard } from './BotHasServer.guard';

describe('BotHasGuildServer', () => {
  let guard: BotHasServerGuard;
  let discordServersService: DiscordServersService;
  const getRequest = jest.fn();
  let context: ExecutionContext;
  const serverId = 'server-id';

  beforeEach(() => {
    getRequest.mockReturnValue({
      params: {
        serverId,
      },
    });
    context = {
      switchToHttp: () => ({
        getRequest,
      }),
    } as never;
    discordServersService = {
      getServer: jest.fn(),
    } as never;

    guard = new BotHasServerGuard(discordServersService);
  });

  it('returns true if guild was found', async () => {
    jest.spyOn(discordServersService, 'getServer').mockResolvedValue({
      id: serverId,
    } as never);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('throws bad request if guild was not found', async () => {
    jest.spyOn(discordServersService, 'getServer').mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws if server id is missing from request params', async () => {
    getRequest.mockReturnValue({
      params: {},
    });

    await expect(guard.canActivate(context)).rejects.toThrow();
  });
});
