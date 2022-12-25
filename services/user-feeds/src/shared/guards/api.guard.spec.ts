import { UnauthorizedException } from "@nestjs/common";
import { ApiGuard } from "./api.guard";

describe("ApiGuard", () => {
  const configService = {
    getOrThrow: jest.fn(),
  };
  let guard: ApiGuard;
  const apiKey = "test-api-key";

  beforeEach(() => {
    guard = new ApiGuard(configService as never);
    configService.getOrThrow.mockImplementation((key) => {
      if (key === "FEED_HANDLER_API_KEY") {
        return apiKey;
      }

      throw new Error(`Unexpected config key in test: ${key}`);
    });
  });

  it("throws if the api key header does not match the config", () => {
    const context = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          headers: {
            "api-key": apiKey + "-wrong",
          },
        }),
      }),
    };

    expect(() => guard.canActivate(context as never)).toThrow(
      UnauthorizedException
    );
  });

  it("returns true if the api key header matches the config", () => {
    const context = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          headers: {
            "api-key": apiKey,
          },
        }),
      }),
    };

    expect(guard.canActivate(context as never)).toEqual(true);
  });
});
