import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { DiscordAuthService } from "../discord-auth.service";
import { DiscordOAuth2Guard } from "./DiscordOAuth2.guard";

describe("DiscordOAuth2 Guard", () => {
  let guard: DiscordOAuth2Guard;
  let discordAuthService: DiscordAuthService;
  const sessionGet = jest.fn();
  const sessionSet = jest.fn();
  let executionContext: ExecutionContext;

  beforeEach(() => {
    jest.resetAllMocks();

    discordAuthService = {
      isTokenExpired: jest.fn(),
      refreshToken: jest.fn(),
    } as never;

    executionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          session: {
            get: sessionGet,
            set: sessionSet,
          },
        }),
      }),
    } as never;

    guard = new DiscordOAuth2Guard(discordAuthService);
  });

  it("rejects with unauthorized if the request session has no access token", async () => {
    await expect(guard.canActivate(executionContext)).rejects.toThrowError(
      UnauthorizedException
    );
  });

  it("returns true if the request session is found and not expired", async () => {
    jest.spyOn(discordAuthService, "isTokenExpired").mockReturnValue(false);
    sessionGet.mockReturnValue({ access_token: "token" });

    await expect(guard.canActivate(executionContext)).resolves.toEqual(true);
  });

  it("refreshes and sets the new token onto the session if it is expired", async () => {
    const currentToken = { access_token: "token" };
    const newToken = { access_token: "newToken" };

    jest.spyOn(discordAuthService, "isTokenExpired").mockReturnValue(true);
    sessionGet.mockReturnValue(currentToken);
    jest
      .spyOn(discordAuthService, "refreshToken")
      .mockResolvedValue(newToken as never);

    await guard.canActivate(executionContext);

    expect(discordAuthService.refreshToken).toHaveBeenCalledWith(currentToken);
    expect(sessionSet).toHaveBeenCalledWith("accessToken", newToken);
  });
});
