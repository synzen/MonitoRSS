/* eslint-disable @typescript-eslint/no-unused-vars */
import { UnauthorizedException } from "@nestjs/common";
import { ApiGuard } from "./api.guard";
import { describe, beforeEach, it } from "node:test";
import assert from "assert";

describe("ApiGuard", () => {
  const configService = {
    getOrThrow: (_: string) => "",
  };
  let guard: ApiGuard;
  const apiKey = "test-api-key";

  beforeEach(() => {
    guard = new ApiGuard(configService as never);

    configService.getOrThrow = (key: string) => {
      if (key === "USER_FEEDS_API_KEY") {
        return apiKey;
      }

      throw new Error(`Unexpected config key in test: ${key}`);
    };
  });

  it("throws if the api key header does not match the config", () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            "api-key": apiKey + "-wrong",
          },
        }),
      }),
    };

    assert.throws(
      () => guard.canActivate(context as never),
      UnauthorizedException
    );
  });

  it("returns true if the api key header matches the config", () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            "api-key": apiKey,
          },
        }),
      }),
    };

    assert.strictEqual(guard.canActivate(context as never), true);
  });
});
