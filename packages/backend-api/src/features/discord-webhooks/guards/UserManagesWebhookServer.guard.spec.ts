import { UserManagesWebhookServerGuard } from './UserManagesWebhookServer.guard';

describe('UserManagesServerGuard', () => {
  let guard: UserManagesWebhookServerGuard;
  const serverId = 'server-id';

  beforeEach(() => {
    guard = new UserManagesWebhookServerGuard({} as never);
  });

  describe('getServerId', () => {
    it('returns the server id from params', () => {
      expect(
        guard.getServerId({
          query: {
            filters: {
              serverId,
            },
          },
        } as never),
      ).resolves.toEqual(serverId);
    });
  });
});
