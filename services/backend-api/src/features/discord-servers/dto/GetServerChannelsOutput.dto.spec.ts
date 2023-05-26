import { DiscordChannelType } from "../../../common";
import { DiscordGuildChannelFormatted } from "../types";
import { GetServerChannelsOutputDto } from "./GetServerChannelsOutput.dto";

describe("GetServerChannelsOutputDto", () => {
  it("returns the mapped entities from discord channels", () => {
    const channels: DiscordGuildChannelFormatted[] = [
      {
        id: "channel_id",
        name: "test",
        guild_id: "guild_id",
        category: null,
        type: DiscordChannelType.GUILD_TEXT,
      },
    ];
    const output = GetServerChannelsOutputDto.fromEntities(channels);

    expect(output.results).toEqual([
      {
        id: channels[0].id,
        name: channels[0].name,
        category: null,
        type: "text",
      },
    ]);
    expect(output.total).toBe(channels.length);
  });
});
