import { GetServerChannelsOutputDto } from './GetServerChannelsOutput.dto';

describe('GetServerChannelsOutputDto', () => {
  it('returns the mapped entities from discord channels', () => {
    const channels = [
      {
        id: 'channel_id',
        name: 'test',
        guild_id: 'guild_id',
        permission_overwrites: [],
      },
    ];
    const output = GetServerChannelsOutputDto.fromEntities(channels);

    expect(output.results).toEqual([
      {
        id: channels[0].id,
        name: channels[0].name,
      },
    ]);
    expect(output.total).toBe(channels.length);
  });
});
