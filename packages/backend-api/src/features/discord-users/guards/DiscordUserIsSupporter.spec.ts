import { UnauthorizedException } from '@nestjs/common';
import { getAccessTokenFromRequest } from '../../discord-auth/utils/get-access-token-from-session';
import { DiscordUserIsSupporterGuard } from './DiscordUserIsSupporter';

jest.mock('../../discord-auth/utils/get-access-token-from-session');

const mockGetAccessToken = getAccessTokenFromRequest as jest.Mock;

describe('DiscordUserIsSupporterGuard', () => {
  const usersService = {
    getUser: jest.fn(),
  };
  const supportersService = {
    getBenefitsOfDiscordUser: jest.fn(),
  };
  const getRequest = jest.fn();
  const context = {
    switchToHttp: jest.fn(),
  };
  let guard: DiscordUserIsSupporterGuard;

  beforeEach(() => {
    jest.resetAllMocks();
    context.switchToHttp.mockReturnValue({
      getRequest,
    });
    guard = new DiscordUserIsSupporterGuard(
      usersService as never,
      supportersService as never,
    );
  });

  describe('canActivate', () => {
    it('throws unauthorized if access token was not found', async () => {
      mockGetAccessToken.mockReturnValue(undefined);

      await expect(guard.canActivate(context as never)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('returns false if user is not supporter', async () => {
      mockGetAccessToken.mockReturnValue({
        access_token: 'accesstoken',
      });
      usersService.getUser.mockResolvedValue({
        id: '123456789',
      });
      supportersService.getBenefitsOfDiscordUser.mockResolvedValue({
        isSupporter: false,
      });

      await expect(guard.canActivate(context as never)).resolves.toBe(false);
    });

    it('returns true if user is supporter', async () => {
      mockGetAccessToken.mockReturnValue({
        access_token: 'accesstoken',
      });
      usersService.getUser.mockResolvedValue({
        id: '123456789',
      });
      supportersService.getBenefitsOfDiscordUser.mockResolvedValue({
        isSupporter: true,
      });

      await expect(guard.canActivate(context as never)).resolves.toBe(true);
    });

    it('throws if get user fails', async () => {
      const error = new Error('get-user-error');
      mockGetAccessToken.mockReturnValue({
        access_token: 'accesstoken',
      });
      usersService.getUser.mockRejectedValue(error);

      await expect(guard.canActivate(context as never)).rejects.toThrow(error);
    });

    it('throws if get benefits fail', async () => {
      const error = new Error('get-benefits-error');
      mockGetAccessToken.mockReturnValue({
        access_token: 'accesstoken',
      });
      usersService.getUser.mockResolvedValue({
        id: '123456789',
      });
      supportersService.getBenefitsOfDiscordUser.mockRejectedValue(error);

      await expect(guard.canActivate(context as never)).rejects.toThrow(error);
    });
  });
});
