import { GetDiscordUserFromAccessTokenPipe } from "./get-discord-user-from-access-token.pipe";

describe("GetDiscordUserFromAccessTokenPipe", () => {
  let pipe: GetDiscordUserFromAccessTokenPipe;
  const discordAuthService = {
    getUser: jest.fn(),
  };

  beforeEach(() => {
    pipe = new GetDiscordUserFromAccessTokenPipe(discordAuthService as never);
  });

  it("returns the user with the access token", () => {
    const accessToken = {
      access_token: "token",
    };
    const user = { id: "user id" };

    discordAuthService.getUser.mockResolvedValue(user);

    expect(pipe.transform(accessToken as never)).resolves.toEqual({
      accessToken,
      user,
    });
  });
});
