import { DiscordGuildRole } from "../../../common";
import { createTestDiscordGuildRole } from "../../../test/data/discord-guild-role.test-data";
import { GetServerRolesOutputDto } from "./GetServerRolesOutput.dto";

describe("GetServerRolesOutputDto", () => {
  it("returns correctly", () => {
    const input: DiscordGuildRole[] = [
      createTestDiscordGuildRole({
        id: "id-1",
        name: "role-1",
        color: 123,
      }),
      createTestDiscordGuildRole({
        id: "id-2",
        name: "role-2",
        color: 456,
      }),
    ];

    const output = GetServerRolesOutputDto.fromEntities(input);
    expect(output).toEqual({
      results: [
        {
          id: "id-1",
          name: "role-1",
          color: "#00007b",
        },
        {
          id: "id-2",
          name: "role-2",
          color: "#0001c8",
        },
      ],
      total: input.length,
    });
  });
});
