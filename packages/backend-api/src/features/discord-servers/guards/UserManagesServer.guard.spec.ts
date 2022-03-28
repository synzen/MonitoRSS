import { UserManagesServerGuard } from './UserManagesServer.guard';

describe('UserManagesServerGuard', () => {
  let guard: UserManagesServerGuard;
  const serverId = 'server-id';

  beforeEach(() => {
    guard = new UserManagesServerGuard({} as never);
  });

  describe('getServerId', () => {
    it('returns the server id from params', () => {
      expect(
        guard.getServerId({
          params: {
            serverId,
          },
        } as never),
      ).resolves.toEqual(serverId);
    });
  });
});
