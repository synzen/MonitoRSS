import 'reflect-metadata';
import ProfileService from './ProfileService';

describe('ProfileService', () => {
  const models = {
    Profile: {
      findOne: jest.fn(),
    },
  };
  let profileService: ProfileService;

  beforeEach(() => {
    jest.resetAllMocks();
    profileService = new ProfileService(models as any);
  });

  describe('findOne', () => {
    it('returns the profile', async () => {
      const profile = {
        _id: '123',
      };
      models.Profile.findOne.mockResolvedValue(profile);
      const found = await profileService.findOne('guildId');
      expect(found).toBe(profile);
    });
  });
});
