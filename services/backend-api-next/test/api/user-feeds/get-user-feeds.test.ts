import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
  createAppTestContext,
  type AppTestContext,
} from "../../helpers/test-context";
import { generateSnowflake, generateTestId } from "../../helpers/test-id";
import {
  FeedConnectionDisabledCode,
  UserFeedDisabledCode,
  UserFeedManagerStatus,
} from "../../../src/repositories/shared/enums";

let ctx: AppTestContext;

before(async () => {
  ctx = await createAppTestContext();
});

after(async () => {
  await ctx.teardown();
});

interface GetUserFeedsResult {
  id: string;
  title: string;
  url: string;
  inputUrl?: string;
  healthStatus: string;
  disabledCode?: string;
  createdAt: string;
  computedStatus: string;
  isLegacyFeed: boolean;
  ownedByUser: boolean;
  refreshRateSeconds?: number;
}

interface GetUserFeedsResponse {
  results: GetUserFeedsResult[];
  total: number;
}

describe("GET /api/v1/user-feeds", { concurrency: true }, () => {
  it("returns 401 without authentication", async () => {
    const response = await ctx.fetch("/api/v1/user-feeds?limit=10&offset=0", {
      method: "GET",
    });
    assert.strictEqual(response.status, 401);
  });

  it("returns 200 with empty results when user has no feeds", async () => {
    const user = await ctx.asUser(generateSnowflake());

    const response = await user.fetch("/api/v1/user-feeds?limit=10&offset=0", {
      method: "GET",
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as GetUserFeedsResponse;
    assert.deepStrictEqual(body.results, []);
    assert.strictEqual(body.total, 0);
  });

  it("returns feeds owned by the user", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "My Listed Feed",
      url: `https://example.com/get-user-feeds-owned-${generateSnowflake()}.xml`,
      user: { id: generateTestId(), discordUserId },
    });

    const response = await user.fetch("/api/v1/user-feeds?limit=10&offset=0", {
      method: "GET",
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as GetUserFeedsResponse;
    const found = body.results.find((r) => r.id === feed.id);
    assert.ok(found);
    assert.strictEqual(found.title, "My Listed Feed");
    assert.strictEqual(found.ownedByUser, true);
    assert.strictEqual(found.isLegacyFeed, false);
  });

  it("does not return feeds belonging to other users", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const otherDiscordUserId = generateSnowflake();
    const user = await ctx.asUser(otherDiscordUserId);

    const uniqueUrl = `https://example.com/get-user-feeds-other-${generateSnowflake()}.xml`;

    await ctx.container.userFeedRepository.create({
      title: "Other User Feed",
      url: uniqueUrl,
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
    });

    const response = await user.fetch("/api/v1/user-feeds?limit=100&offset=0", {
      method: "GET",
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as GetUserFeedsResponse;
    const found = body.results.find((r) => r.url === uniqueUrl);
    assert.strictEqual(found, undefined);
  });

  it("returns feeds where user is accepted shared manager", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const sharedManagerDiscordUserId = generateSnowflake();
    const user = await ctx.asUser(sharedManagerDiscordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Shared Feed Listed",
      url: `https://example.com/get-user-feeds-shared-${generateSnowflake()}.xml`,
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      shareManageOptions: {
        invites: [
          {
            discordUserId: sharedManagerDiscordUserId,
            status: UserFeedManagerStatus.Accepted,
          },
        ],
      },
    });

    const response = await user.fetch("/api/v1/user-feeds?limit=100&offset=0", {
      method: "GET",
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as GetUserFeedsResponse;
    const found = body.results.find((r) => r.id === feed.id);
    assert.ok(found);
    assert.strictEqual(found.ownedByUser, false);
  });

  it("does not return feeds where user has pending invite", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const pendingDiscordUserId = generateSnowflake();
    const user = await ctx.asUser(pendingDiscordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Pending Invite Feed",
      url: `https://example.com/get-user-feeds-pending-${generateSnowflake()}.xml`,
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      shareManageOptions: {
        invites: [
          {
            discordUserId: pendingDiscordUserId,
            status: UserFeedManagerStatus.Pending,
          },
        ],
      },
    });

    const response = await user.fetch("/api/v1/user-feeds?limit=100&offset=0", {
      method: "GET",
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as GetUserFeedsResponse;
    const found = body.results.find((r) => r.id === feed.id);
    assert.strictEqual(found, undefined);
  });

  it("returns correct total count", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const userId = generateTestId();

    await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        ctx.container.userFeedRepository.create({
          title: `Count Feed ${i}`,
          url: `https://example.com/get-user-feeds-count-${generateSnowflake()}-${i}.xml`,
          user: { id: userId, discordUserId },
        }),
      ),
    );

    const response = await user.fetch("/api/v1/user-feeds?limit=2&offset=0", {
      method: "GET",
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as GetUserFeedsResponse;
    assert.ok(body.total >= 3);
    assert.strictEqual(body.results.length, 2);
  });

  it("respects limit and offset pagination", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const userId = generateTestId();

    await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        ctx.container.userFeedRepository.create({
          title: `Paginated Feed ${i}`,
          url: `https://example.com/get-user-feeds-paginate-${generateSnowflake()}-${i}.xml`,
          user: { id: userId, discordUserId },
        }),
      ),
    );

    const response = await user.fetch("/api/v1/user-feeds?limit=1&offset=1", {
      method: "GET",
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as GetUserFeedsResponse;
    assert.strictEqual(body.results.length, 1);
    assert.ok(body.total >= 3);
  });

  it("filters by search parameter", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const userId = generateTestId();
    const uniqueToken = generateSnowflake();

    await ctx.container.userFeedRepository.create({
      title: `Searchable ${uniqueToken}`,
      url: `https://example.com/get-user-feeds-search-${generateSnowflake()}.xml`,
      user: { id: userId, discordUserId },
    });

    await ctx.container.userFeedRepository.create({
      title: "Other Feed No Match",
      url: `https://example.com/get-user-feeds-nomatch-${generateSnowflake()}.xml`,
      user: { id: userId, discordUserId },
    });

    const response = await user.fetch(
      `/api/v1/user-feeds?limit=100&offset=0&search=${uniqueToken}`,
      {
        method: "GET",
      },
    );

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as GetUserFeedsResponse;
    assert.ok(body.results.length >= 1);
    assert.ok(body.results.every((r) => r.title.includes(uniqueToken)));
  });

  it("filters by computedStatuses", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const userId = generateTestId();

    const disabledFeed = await ctx.container.userFeedRepository.create({
      title: "Manually Disabled Feed",
      url: `https://example.com/get-user-feeds-disabled-${generateSnowflake()}.xml`,
      user: { id: userId, discordUserId },
    });

    await ctx.container.userFeedRepository.findOneAndUpdate(
      { _id: disabledFeed.id },
      { $set: { disabledCode: UserFeedDisabledCode.Manual } },
    );

    await ctx.container.userFeedRepository.create({
      title: "OK Feed",
      url: `https://example.com/get-user-feeds-ok-${generateSnowflake()}.xml`,
      user: { id: userId, discordUserId },
    });

    const response = await user.fetch(
      `/api/v1/user-feeds?limit=100&offset=0&filters[computedStatuses]=MANUALLY_DISABLED`,
      {
        method: "GET",
      },
    );

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as GetUserFeedsResponse;
    assert.ok(body.results.length >= 1);
    assert.ok(
      body.results.every((r) => r.computedStatus === "MANUALLY_DISABLED"),
    );
  });

  it("filters by disabledCodes", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const userId = generateTestId();

    const badFormatFeed = await ctx.container.userFeedRepository.create({
      title: "Bad Format Feed",
      url: `https://example.com/get-user-feeds-badformat-${generateSnowflake()}.xml`,
      user: { id: userId, discordUserId },
    });

    await ctx.container.userFeedRepository.findOneAndUpdate(
      { _id: badFormatFeed.id },
      { $set: { disabledCode: UserFeedDisabledCode.BadFormat } },
    );

    await ctx.container.userFeedRepository.create({
      title: "Normal Feed",
      url: `https://example.com/get-user-feeds-normal-${generateSnowflake()}.xml`,
      user: { id: userId, discordUserId },
    });

    const response = await user.fetch(
      `/api/v1/user-feeds?limit=100&offset=0&filters[disabledCodes]=BAD_FORMAT`,
      {
        method: "GET",
      },
    );

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as GetUserFeedsResponse;
    assert.ok(body.results.length >= 1);
    assert.ok(body.results.every((r) => r.disabledCode === "BAD_FORMAT"));
  });

  it("sorts by title ascending", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const userId = generateTestId();
    const token = generateSnowflake();

    await ctx.container.userFeedRepository.create({
      title: `ZZZ ${token}`,
      url: `https://example.com/get-user-feeds-sort-z-${generateSnowflake()}.xml`,
      user: { id: userId, discordUserId },
    });

    await ctx.container.userFeedRepository.create({
      title: `AAA ${token}`,
      url: `https://example.com/get-user-feeds-sort-a-${generateSnowflake()}.xml`,
      user: { id: userId, discordUserId },
    });

    const response = await user.fetch(
      `/api/v1/user-feeds?limit=100&offset=0&sort=title&search=${token}`,
      {
        method: "GET",
      },
    );

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as GetUserFeedsResponse;
    assert.strictEqual(body.results.length, 2);
    assert.strictEqual(body.results[0]!.title, `AAA ${token}`);
    assert.strictEqual(body.results[1]!.title, `ZZZ ${token}`);
  });

  it("sorts by title descending", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const userId = generateTestId();
    const token = generateSnowflake();

    await ctx.container.userFeedRepository.create({
      title: `AAA ${token}`,
      url: `https://example.com/get-user-feeds-sortd-a-${generateSnowflake()}.xml`,
      user: { id: userId, discordUserId },
    });

    await ctx.container.userFeedRepository.create({
      title: `ZZZ ${token}`,
      url: `https://example.com/get-user-feeds-sortd-z-${generateSnowflake()}.xml`,
      user: { id: userId, discordUserId },
    });

    const response = await user.fetch(
      `/api/v1/user-feeds?limit=100&offset=0&sort=-title&search=${token}`,
      {
        method: "GET",
      },
    );

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as GetUserFeedsResponse;
    assert.strictEqual(body.results.length, 2);
    assert.strictEqual(body.results[0]!.title, `ZZZ ${token}`);
    assert.strictEqual(body.results[1]!.title, `AAA ${token}`);
  });

  it("filters by connectionDisabledCodes", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const userId = generateTestId();

    const feedWithBadConn = await ctx.container.userFeedRepository.create({
      title: "Feed Bad Connection",
      url: `https://example.com/get-user-feeds-conndc-${generateSnowflake()}.xml`,
      user: { id: userId, discordUserId },
    });

    await ctx.container.userFeedRepository.findOneAndUpdate(
      { _id: feedWithBadConn.id },
      {
        $set: {
          "connections.discordChannels": [
            {
              id: generateTestId(),
              name: "test-channel",
              disabledCode: FeedConnectionDisabledCode.MissingPermissions,
            },
          ],
        },
      },
    );

    await ctx.container.userFeedRepository.create({
      title: "Feed OK Connection",
      url: `https://example.com/get-user-feeds-connok-${generateSnowflake()}.xml`,
      user: { id: userId, discordUserId },
    });

    const response = await user.fetch(
      `/api/v1/user-feeds?limit=100&offset=0&filters[connectionDisabledCodes]=MISSING_PERMISSIONS`,
      {
        method: "GET",
      },
    );

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as GetUserFeedsResponse;
    assert.ok(body.results.length >= 1);
    const found = body.results.find((r) => r.id === feedWithBadConn.id);
    assert.ok(found);
  });

  it("filters by ownedByUser", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const sharedDiscordUserId = generateSnowflake();
    const user = await ctx.asUser(sharedDiscordUserId);
    const token = generateSnowflake();

    await ctx.container.userFeedRepository.create({
      title: `Owned Feed ${token}`,
      url: `https://example.com/get-user-feeds-ownfilter-own-${generateSnowflake()}.xml`,
      user: { id: generateTestId(), discordUserId: sharedDiscordUserId },
    });

    await ctx.container.userFeedRepository.create({
      title: `Shared Feed ${token}`,
      url: `https://example.com/get-user-feeds-ownfilter-shared-${generateSnowflake()}.xml`,
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      shareManageOptions: {
        invites: [
          {
            discordUserId: sharedDiscordUserId,
            status: UserFeedManagerStatus.Accepted,
          },
        ],
      },
    });

    const response = await user.fetch(
      `/api/v1/user-feeds?limit=100&offset=0&search=${token}&filters[ownedByUser]=true`,
      {
        method: "GET",
      },
    );

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as GetUserFeedsResponse;
    assert.ok(body.results.length >= 1);
    assert.ok(body.results.every((r) => r.ownedByUser === true));
  });

  it("searches by URL", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const userId = generateTestId();
    const uniqueToken = generateSnowflake();

    await ctx.container.userFeedRepository.create({
      title: "Generic Title",
      url: `https://example.com/searchable-url-${uniqueToken}.xml`,
      user: { id: userId, discordUserId },
    });

    await ctx.container.userFeedRepository.create({
      title: "Other Feed",
      url: `https://example.com/no-match-url-${generateSnowflake()}.xml`,
      user: { id: userId, discordUserId },
    });

    const response = await user.fetch(
      `/api/v1/user-feeds?limit=100&offset=0&search=${uniqueToken}`,
      {
        method: "GET",
      },
    );

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as GetUserFeedsResponse;
    assert.ok(body.results.length >= 1);
    assert.ok(body.results.every((r) => r.url.includes(uniqueToken)));
  });

  it("filters by empty disabledCodes to find feeds with no disabled code", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const userId = generateTestId();
    const token = generateSnowflake();

    await ctx.container.userFeedRepository.create({
      title: `Enabled Feed ${token}`,
      url: `https://example.com/get-user-feeds-emptydc-ok-${generateSnowflake()}.xml`,
      user: { id: userId, discordUserId },
    });

    const disabledFeed = await ctx.container.userFeedRepository.create({
      title: `Disabled Feed ${token}`,
      url: `https://example.com/get-user-feeds-emptydc-dis-${generateSnowflake()}.xml`,
      user: { id: userId, discordUserId },
    });

    await ctx.container.userFeedRepository.findOneAndUpdate(
      { _id: disabledFeed.id },
      { $set: { disabledCode: UserFeedDisabledCode.Manual } },
    );

    const response = await user.fetch(
      `/api/v1/user-feeds?limit=100&offset=0&search=${token}&filters[disabledCodes]=`,
      {
        method: "GET",
      },
    );

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as GetUserFeedsResponse;
    assert.ok(body.results.length >= 1);
    assert.ok(
      body.results.every(
        (r) => r.disabledCode === undefined || r.disabledCode === null,
      ),
    );
  });

  it("accepts empty string for sort parameter and uses default sort", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const userId = generateTestId();

    await ctx.container.userFeedRepository.create({
      title: "Empty Sort Test Feed",
      url: `https://example.com/get-user-feeds-emptysort-${generateSnowflake()}.xml`,
      user: { id: userId, discordUserId },
    });

    const response = await user.fetch(
      "/api/v1/user-feeds?limit=10&offset=0&sort=",
      {
        method: "GET",
      },
    );

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as GetUserFeedsResponse;
    assert.ok(Array.isArray(body.results));
  });

  it("returns 400 when limit is missing", async () => {
    const user = await ctx.asUser(generateSnowflake());

    const response = await user.fetch("/api/v1/user-feeds?offset=0", {
      method: "GET",
    });

    assert.strictEqual(response.status, 400);
  });

  it("returns 400 when offset is missing", async () => {
    const user = await ctx.asUser(generateSnowflake());

    const response = await user.fetch("/api/v1/user-feeds?limit=10", {
      method: "GET",
    });

    assert.strictEqual(response.status, 400);
  });

  it("returns empty results when offset exceeds total", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const userId = generateTestId();

    await ctx.container.userFeedRepository.create({
      title: "Offset Test Feed",
      url: `https://example.com/get-user-feeds-bigoffset-${generateSnowflake()}.xml`,
      user: { id: userId, discordUserId },
    });

    const response = await user.fetch(
      "/api/v1/user-feeds?limit=10&offset=9999",
      {
        method: "GET",
      },
    );

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as GetUserFeedsResponse;
    assert.strictEqual(body.results.length, 0);
    assert.ok(body.total >= 1);
  });

  it("returns correct response shape", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    await ctx.container.userFeedRepository.create({
      title: "Shape Test Feed",
      url: `https://example.com/get-user-feeds-shape-${generateSnowflake()}.xml`,
      user: { id: generateTestId(), discordUserId },
    });

    const response = await user.fetch("/api/v1/user-feeds?limit=10&offset=0", {
      method: "GET",
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as GetUserFeedsResponse;
    assert.ok(body.results.length >= 1);

    const feed = body.results[0]!;
    assert.ok(typeof feed.id === "string");
    assert.ok(typeof feed.title === "string");
    assert.ok(typeof feed.url === "string");
    assert.ok(typeof feed.healthStatus === "string");
    assert.ok(typeof feed.createdAt === "string");
    assert.ok(typeof feed.computedStatus === "string");
    assert.strictEqual(feed.isLegacyFeed, false);
    assert.ok(typeof feed.ownedByUser === "boolean");
  });
});
