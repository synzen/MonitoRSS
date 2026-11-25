import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
  FeedConnectionDisabledCode,
  UserFeedDisabledCode,
} from "../../src/repositories/shared/enums";
import {
  GetArticlesInput,
  GetArticlesResponseRequestStatus,
} from "../../src/services/feed-handler/types";
import {
  BannedFeedException,
  FeedLimitReachedException,
  ManualRequestTooSoonException,
  PremiumFeedsLimitReachedException,
  PremiumFeedsNotSupportedException,
  PremiumFeedsPlanRequiredException,
  RedditConnectionRequiredException,
  RefreshRateNotAllowedException,
  SourceFeedNotFoundException,
} from "../../src/shared/exceptions/user-feeds.exceptions";
import {
  UserFeedDisabledCode as RepoUserFeedDisabledCode,
  UserFeedHealthStatus,
} from "../../src/repositories/shared/enums";
import { createUserFeedsHarness } from "../helpers/user-feeds.harness";
import { createMockDiscordChannelConnection } from "../helpers/mock-factories";
import { ScheduleHandlerService } from "../../src/services/schedule-handler/schedule-handler.service";
import { UserFeedCopyableSetting } from "../../src/services/user-feeds/types";
import { UserFeedTargetFeedSelectionType } from "../../src/services/feed-connections-discord-channels/types";

const TEST_MAX_USER_FEEDS = 5;
const TEST_REFRESH_RATE_SECONDS = 600;
const TEST_MAX_DAILY_ARTICLES = 100;

describe("UserFeedsService", { concurrency: true }, () => {
  const harness = createUserFeedsHarness();

  before(() => harness.setup());
  after(() => harness.teardown());

  describe("deduplicateFeedUrls", () => {
    it("removes URLs that user already has", async () => {
      const ctx = await harness.createContext();
      const existingUrl = `https://example.com/${ctx.generateId()}.xml`;

      await ctx.createFeed({ url: existingUrl });

      const result = await ctx.service.deduplicateFeedUrls(ctx.discordUserId, [
        existingUrl,
        "https://example.com/new.xml",
      ]);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0], "https://example.com/new.xml");
    });

    it("returns all URLs if none exist", async () => {
      const ctx = await harness.createContext();

      const result = await ctx.service.deduplicateFeedUrls(ctx.discordUserId, [
        "https://example.com/1.xml",
        "https://example.com/2.xml",
      ]);

      assert.strictEqual(result.length, 2);
    });
  });

  describe("Reddit credential gate", () => {
    const REDDIT_URL = "https://www.reddit.com/r/gaming/.rss";
    const REDDIT_CLIENT_ID = "test-reddit-client-id";
    const revokedReddit = [{ type: "reddit", status: "REVOKED", data: {} }];

    const addReddit = (ctx: Awaited<ReturnType<typeof harness.createContext>>) =>
      ctx.service.addFeed(
        { discordUserId: ctx.discordUserId, userAccessToken: "token" },
        { url: REDDIT_URL },
      );

    const validateReddit = (ctx: Awaited<ReturnType<typeof harness.createContext>>) =>
      ctx.service.validateFeedUrl(
        { discordUserId: ctx.discordUserId },
        { url: REDDIT_URL },
      );

    it("rejects addFeed for a reddit url without an active connection", async () => {
      const ctx = await harness.createContext({
        redditClientId: REDDIT_CLIENT_ID,
        externalCredentials: [],
        feedHandler: { url: REDDIT_URL, feedTitle: "gaming" },
      });

      await assert.rejects(
        addReddit(ctx),
        RedditConnectionRequiredException,
      );
    });

    it("allows validateFeedUrl for a reddit url without an active connection", async () => {
      const ctx = await harness.createContext({
        redditClientId: REDDIT_CLIENT_ID,
        externalCredentials: [],
        feedHandler: { url: REDDIT_URL, feedTitle: "gaming" },
      });

      const result = await validateReddit(ctx);

      assert.strictEqual(result.feedTitle, "gaming");
    });

    it("rejects addFeed when the reddit connection is REVOKED", async () => {
      const ctx = await harness.createContext({
        redditClientId: REDDIT_CLIENT_ID,
        externalCredentials: revokedReddit,
        feedHandler: { url: REDDIT_URL, feedTitle: "gaming" },
      });

      await assert.rejects(
        addReddit(ctx),
        RedditConnectionRequiredException,
      );
    });

    it("does not gate non-reddit urls", async () => {
      const ctx = await harness.createContext({
        redditClientId: REDDIT_CLIENT_ID,
        feedHandler: {
          url: "https://example.com/feed.xml",
          feedTitle: "Example",
        },
      });

      const feed = await ctx.service.addFeed(
        { discordUserId: ctx.discordUserId, userAccessToken: "token" },
        { url: "https://example.com/feed.xml" },
      );

      assert.ok(feed.id);
    });
  });

  describe("natural reddit URL normalization (opt-in, new feeds only)", () => {
    // Mirrors the package canonicalizer for the single form these tests use:
    // .rss-suffixed forms become the destination URL; other inputs stay raw.
    const resolveRedditRss = (url: string) =>
      url.endsWith(".rss") ? url.slice(0, -".rss".length) : null;

    const NATURAL_URL = "https://old.reddit.com/r/gaming/new.rss";
    const CANONICAL_URL = "https://old.reddit.com/r/gaming/new";

    const ctxWithResolver = async (
      options: Parameters<typeof harness.createContext>[0] = {},
    ) =>
      await harness.createContext({
        ...options,
        feedFetcherApiService: { resolvePlatformUrl: resolveRedditRss },
      });

    it("addFeed stores the canonical url and keeps the raw input", async () => {
      const ctx = await ctxWithResolver({
        feedHandler: { url: CANONICAL_URL, feedTitle: "gaming" },
      });

      const feed = await ctx.service.addFeed(
        { discordUserId: ctx.discordUserId, userAccessToken: "token" },
        { url: NATURAL_URL },
      );

      assert.strictEqual(feed.url, CANONICAL_URL);
      assert.strictEqual(feed.inputUrl, NATURAL_URL);
      assert.strictEqual(feed.isMeteredPlatformFeed, undefined);
    });

    it("validateFeedUrl resolves the canonical url", async () => {
      const ctx = await ctxWithResolver({
        feedHandler: { url: CANONICAL_URL, feedTitle: "gaming" },
      });

      const result = await ctx.service.validateFeedUrl(
        { discordUserId: ctx.discordUserId },
        { url: NATURAL_URL },
      );

      assert.strictEqual(result.resolvedToUrl, CANONICAL_URL);
    });

    it("updateFeed url change stores the canonical url and keeps a credentialed lookup key", async () => {
      const ctx = await ctxWithResolver({
        feedHandler: { url: CANONICAL_URL, feedTitle: "gaming" },
      });

      const feed = await ctx.createFeed({
        url: "https://www.reddit.com/r/gaming/.rss",
      });
      // Unique per test: the suite runs with concurrency and the lookup-key
      // index is unique, so hardcoded fixture keys collide across tests.
      await ctx.setFields(feed.id, {
        feedRequestLookupKey: `lookup-key-${ctx.generateId()}`,
      });

      const updated = await ctx.service.updateFeedById(
        { id: feed.id },
        { url: NATURAL_URL },
      );

      assert.strictEqual(updated?.url, CANONICAL_URL);
      const stored = await ctx.findById(feed.id);
      assert.ok(stored);
      // Reddit fetches carry the owner's grant, so the credentialed lookup
      // path stays intact on re-URL.
      assert.ok(stored.feedRequestLookupKey);
    });

    it("clone onto a natural URL stores the canonical url and mints a fresh lookup key", async () => {
      const ctx = await ctxWithResolver({
        feedHandler: { url: CANONICAL_URL, feedTitle: "gaming" },
      });

      const source = await ctx.createFeed({
        url: "https://www.reddit.com/r/gaming/.rss",
      });
      // Unique per test: the suite runs with concurrency and the lookup-key
      // index is unique, so hardcoded fixture keys collide across tests.
      const sourceKey = `lookup-key-${ctx.generateId()}`;
      await ctx.setFields(source.id, {
        feedRequestLookupKey: sourceKey,
      });

      const cloned = await ctx.service.clone(source.id, "token", {
        url: NATURAL_URL,
      });

      const clonedFeed = await ctx.findById(cloned.id!);
      assert.ok(clonedFeed);
      assert.strictEqual(clonedFeed.url, CANONICAL_URL);
      // The clone never shares the source's request-row key; reddit clones
      // mint a fresh one so their fetches carry the owner's grant.
      assert.ok(clonedFeed.feedRequestLookupKey);
      assert.notStrictEqual(clonedFeed.feedRequestLookupKey, sourceKey);
    });
  });

  describe("premium feeds (closed-beta gate, allowances, floor)", () => {
    const REDDIT_URL = "https://www.reddit.com/r/gaming";
    const OTHER_PLATFORM_URL = "https://x.com/someuser";
    const FLOOR_SECONDS = 7200;
    // The harness default tier rate (600s) sits below the floor, so every
    // floor-bearing platform write-path assertion exercises the clamp. The
    // raised feed caps keep the regular feed limit out of the way of the
    // allowance assertions.
    const flaggedSupporterOptions = {
      billingEnabled: true,
      isSupporter: true,
      maxUserFeeds: 20,
      workspaceMaxFeeds: 20,
      featureFlags: { premiumFeeds: true } as const,
      feedHandler: { url: REDDIT_URL, feedTitle: "gaming" },
    };
    // Metered platform feeds carry the closed-beta gate and refresh-rate floor.
    // These options classify the mock fetch as x.com.
    const floorSupporterOptions = {
      ...flaggedSupporterOptions,
      feedHandler: { url: OTHER_PLATFORM_URL, feedTitle: "X" },
    };

    const addReddit = (ctx: Awaited<ReturnType<typeof harness.createContext>>) =>
      ctx.service.addFeed(
        { discordUserId: ctx.discordUserId, userAccessToken: "token" },
        { url: REDDIT_URL },
      );

    const addOtherPlatform = (
      ctx: Awaited<ReturnType<typeof harness.createContext>>,
    ) =>
      ctx.service.addFeed(
        { discordUserId: ctx.discordUserId, userAccessToken: "token" },
        { url: OTHER_PLATFORM_URL },
      );

    describe("access gate", () => {
      it("falls through silently for a metered platform url without the beta flag", async () => {
        const ctx = await harness.createContext({
          billingEnabled: true,
          isSupporter: true,
          feedHandler: { url: OTHER_PLATFORM_URL, feedTitle: "X" },
        });

        const feed = await addOtherPlatform(ctx);

        assert.ok(feed.id);
        assert.strictEqual(feed.isMeteredPlatformFeed, undefined);
        assert.strictEqual(feed.refreshRateSeconds, 600);
      });

      it("allows addFeed for a metered platform url with the beta flag", async () => {
        const ctx = await harness.createContext(flaggedSupporterOptions);

        const feed = await addOtherPlatform(ctx);

        assert.ok(feed.id);
      });

      it("allows reddit without the beta flag or paid plan when its grant is active", async () => {
        const ctx = await harness.createContext({
          billingEnabled: true,
          isSupporter: false,
          feedHandler: { url: REDDIT_URL, feedTitle: "gaming" },
        });

        const feed = await addReddit(ctx);

        assert.ok(feed.id);
      });

      it("allows addFeed without the flag when billing is disabled (self-host)", async () => {
        const ctx = await harness.createContext({
          feedHandler: { url: REDDIT_URL, feedTitle: "gaming" },
        });

        const feed = await addReddit(ctx);

        assert.ok(feed.id);
      });

      it("fails closed when classification is unavailable", async () => {
        const ctx = await harness.createContext({
          ...flaggedSupporterOptions,
          feedFetcherApiService: {
            classifyUrlsError: new Error("feed-requests unreachable"),
          },
        });

        await assert.rejects(addReddit(ctx), /feed-requests unreachable/);
      });
    });

    describe("plan gate", () => {
      it("rejects a flagged non-supporter personal add", async () => {
        const ctx = await harness.createContext({
          billingEnabled: true,
          isSupporter: false,
          featureFlags: { premiumFeeds: true },
          feedHandler: { url: OTHER_PLATFORM_URL, feedTitle: "X" },
        });

        await assert.rejects(
          addOtherPlatform(ctx),
          PremiumFeedsPlanRequiredException,
        );
      });
    });

    describe("allowances", () => {
      it("allows the 2nd personal premium feed and blocks the 3rd", async () => {
        const ctx = await harness.createContext({
          ...flaggedSupporterOptions,
          feedHandler: { url: "https://x.com/user2", feedTitle: "X" },
        });

        await ctx.createFeed({ url: "https://x.com/user0" });

        await ctx.service.addFeed(
          { discordUserId: ctx.discordUserId, userAccessToken: "token" },
          { url: "https://x.com/user1" },
        );

        await assert.rejects(
          ctx.service.addFeed(
            { discordUserId: ctx.discordUserId, userAccessToken: "token" },
            { url: "https://x.com/user2" },
          ),
          PremiumFeedsLimitReachedException,
        );
      });

      it("does not count non-premium feeds toward the allowance", async () => {
        const ctx = await harness.createContext(flaggedSupporterOptions);

        await ctx.createMany(7);

        const feed = await addReddit(ctx);

        assert.ok(feed.id);
      });

      it("blocks the 6th workspace premium feed (allowance floor 5 for a small plan)", async () => {
        const ctx = await harness.createContext({
          ...flaggedSupporterOptions,
          feedHandler: { url: "https://x.com/workspace-user5", feedTitle: "X" },
        });
        const workspace = await ctx.createWorkspace();

        for (let i = 0; i < 5; i++) {
          await ctx.createWorkspaceFeed(workspace.id, {
            url: `https://x.com/workspace-user${i}`,
          });
        }

        await assert.rejects(
          ctx.service.addFeed(
            { discordUserId: ctx.discordUserId, userAccessToken: "token" },
            { url: "https://x.com/workspace-user5", workspaceId: workspace.id },
          ),
          PremiumFeedsLimitReachedException,
        );
      });

      it("scales the workspace allowance with the plan's feed limit", async () => {
        const ctx = await harness.createContext({
          ...flaggedSupporterOptions,
          workspaceMaxFeeds: 140,
          feedHandler: { url: "https://x.com/workspace-user10", feedTitle: "X" },
        });
        const workspace = await ctx.createWorkspace();

        for (let i = 0; i < 10; i++) {
          await ctx.createWorkspaceFeed(workspace.id, {
            url: `https://x.com/workspace-user${i}`,
          });
        }

        // ceil(140 * 0.07) = 10: the 11th slot is beyond the allowance.
        await assert.rejects(
          ctx.service.addFeed(
            { discordUserId: ctx.discordUserId, userAccessToken: "token" },
            { url: "https://x.com/workspace-user10", workspaceId: workspace.id },
          ),
          PremiumFeedsLimitReachedException,
        );
      });

      it("allows re-URLing an existing premium feed (its slot is already counted)", async () => {
        const ctx = await harness.createContext(flaggedSupporterOptions);

        await ctx.createFeed({ url: "https://x.com/user0" });

        // The 2nd (and last allowance slot).
        const feed = await addOtherPlatform(ctx);

        await assert.doesNotReject(
          ctx.service.updateFeedById(
            { id: feed.id },
            { url: "https://x.com/user2" },
          ),
        );
      });

      it("blocks URL-changing a non-premium feed to platform beyond the allowance", async () => {
        const ctx = await harness.createContext({
          ...flaggedSupporterOptions,
          feedHandler: { url: "https://x.com/user2", feedTitle: "X" },
        });

        await ctx.createFeed({ url: "https://x.com/user0" });
        await ctx.createFeed({ url: "https://x.com/user1" });

        const regular = await ctx.createFeed({});

        await assert.rejects(
          ctx.service.updateFeedById(
            { id: regular.id },
            { url: "https://x.com/user2" },
          ),
          PremiumFeedsLimitReachedException,
        );
      });
    });

    describe("refresh-rate floor", () => {
      it("clamps the created refreshRateSeconds to the floor", async () => {
        const ctx = await harness.createContext(floorSupporterOptions);

        const feed = await addOtherPlatform(ctx);

        assert.strictEqual(feed.isMeteredPlatformFeed, true);
        assert.strictEqual(feed.refreshRateSeconds, FLOOR_SECONDS);
      });

      it("leaves non-premium refresh rates untouched", async () => {
        const ctx = await harness.createContext({
          ...flaggedSupporterOptions,
          feedHandler: {
            url: "https://example.com/feed.xml",
            feedTitle: "Example",
          },
        });

        const feed = await ctx.service.addFeed(
          { discordUserId: ctx.discordUserId, userAccessToken: "token" },
          { url: "https://example.com/feed.xml" },
        );

        assert.strictEqual(feed.refreshRateSeconds, 600);
      });

      it("rejects a user refresh rate below the floor on a platform feed", async () => {
        const ctx = await harness.createContext(floorSupporterOptions);

        const feed = await addOtherPlatform(ctx);

        await assert.rejects(
          ctx.service.updateFeedById(
            { id: feed.id },
            { userRefreshRateSeconds: 600 },
          ),
          RefreshRateNotAllowedException,
        );
      });

      it("allows a user refresh rate at the floor", async () => {
        const ctx = await harness.createContext(floorSupporterOptions);

        const feed = await addOtherPlatform(ctx);

        const updated = await ctx.service.updateFeedById(
          { id: feed.id },
          { userRefreshRateSeconds: FLOOR_SECONDS },
        );

        assert.strictEqual(updated?.userRefreshRateSeconds, FLOOR_SECONDS);
      });

      it("clamps the stored base rate when a URL change makes a feed premium", async () => {
        const ctx = await harness.createContext(floorSupporterOptions);

        const feed = await ctx.createFeed({});

        const updated = await ctx.service.updateFeedById(
          { id: feed.id },
          { url: OTHER_PLATFORM_URL },
        );

        assert.strictEqual(updated?.refreshRateSeconds, FLOOR_SECONDS);
      });

      it("rejects a sub-floor user rate sent alongside a URL change to platform", async () => {
        const ctx = await harness.createContext(floorSupporterOptions);

        const feed = await ctx.createFeed({});

        await assert.rejects(
          ctx.service.updateFeedById(
            { id: feed.id },
            { url: OTHER_PLATFORM_URL, userRefreshRateSeconds: 600 },
          ),
          RefreshRateNotAllowedException,
        );
      });

      it("drops a sub-floor user rate when cloning onto a platform URL", async () => {
        const ctx = await harness.createContext(floorSupporterOptions);

        const feed = await addOtherPlatform(ctx);
        // Stamp a sub-floor user rate directly; the update path would reject it.
        await ctx.setFields(feed.id, { userRefreshRateSeconds: 600 });

        const cloned = await ctx.service.clone(feed.id, "token");

        const clonedFeed = await ctx.findById(cloned.id!);
        assert.ok(clonedFeed);
        assert.ok(!clonedFeed.userRefreshRateSeconds);
        assert.strictEqual(clonedFeed.refreshRateSeconds, FLOOR_SECONDS);
      });

      it("keeps an at-floor user rate when cloning a platform feed", async () => {
        const ctx = await harness.createContext(floorSupporterOptions);

        const feed = await addOtherPlatform(ctx);
        await ctx.service.updateFeedById(
          { id: feed.id },
          { userRefreshRateSeconds: FLOOR_SECONDS },
        );

        const cloned = await ctx.service.clone(feed.id, "token");

        const clonedFeed = await ctx.findById(cloned.id!);
        assert.strictEqual(clonedFeed?.userRefreshRateSeconds, FLOOR_SECONDS);
      });

      describe("reddit exemption", () => {
        it("does not clamp a reddit feed's created rate to the floor", async () => {
          const ctx = await harness.createContext(flaggedSupporterOptions);

          const feed = await addReddit(ctx);

          // Reddit is platform-gated but its credentialed fetches are not
          // metered, so it inherits the regular tier rate.
          assert.strictEqual(feed.isMeteredPlatformFeed, undefined);
          assert.strictEqual(feed.refreshRateSeconds, 600);
        });

        it("allows a reddit user rate below the floor", async () => {
          const ctx = await harness.createContext(flaggedSupporterOptions);

          const feed = await addReddit(ctx);

          const updated = await ctx.service.updateFeedById(
            { id: feed.id },
            { userRefreshRateSeconds: 1200 },
          );

          assert.strictEqual(updated?.userRefreshRateSeconds, 1200);
        });

        it("does not clamp the stored base rate when a URL change makes a feed reddit", async () => {
          const ctx = await harness.createContext(flaggedSupporterOptions);

          const feed = await ctx.createFeed({});

          const updated = await ctx.service.updateFeedById(
            { id: feed.id },
            { url: REDDIT_URL },
          );

          assert.strictEqual(updated?.refreshRateSeconds, 600);
          assert.strictEqual(updated?.isMeteredPlatformFeed, undefined);
        });

        it("clears the metered flag when cloning onto a reddit URL", async () => {
          const ctx = await harness.createContext({ ...floorSupporterOptions, feedHandler: { url: "https://www.reddit.com/r/other", feedTitle: "other" } });
          const source = await addOtherPlatform(ctx);
          await ctx.service.updateFeedById(
            { id: source.id },
            { userRefreshRateSeconds: FLOOR_SECONDS },
          );

          const cloned = await ctx.service.clone(source.id, "token", {
            url: "https://www.reddit.com/r/other",
          });

          const clonedFeed = await ctx.findById(cloned.id!);
          assert.strictEqual(clonedFeed?.isMeteredPlatformFeed, undefined);
        });

        it("keeps a sub-floor user rate when cloning a reddit feed", async () => {
          const ctx = await harness.createContext(flaggedSupporterOptions);

          const feed = await addReddit(ctx);
          await ctx.service.updateFeedById(
            { id: feed.id },
            { userRefreshRateSeconds: 1200 },
          );

          const cloned = await ctx.service.clone(feed.id, "token");

          const clonedFeed = await ctx.findById(cloned.id!);
          assert.strictEqual(clonedFeed?.userRefreshRateSeconds, 1200);
        });
      });
    });

    describe("copy-settings floor", () => {
      it("drops a sub-floor source rate on platform targets but keeps it on regular and reddit targets", async () => {
        const ctx = await harness.createContext(floorSupporterOptions);

        const platformTarget = await addOtherPlatform(ctx);
        const regularTarget = await ctx.createFeed({});
        // Created directly so it keeps a reddit URL under the x.com validation
        // mock; the copy-settings floor classification reads the stored URL.
        const redditTarget = await ctx.createFeed({ url: REDDIT_URL });
        await ctx.setFields(redditTarget.id, { isMeteredPlatformFeed: true });
        const source = await ctx.createFeed({});
        await ctx.setFields(source.id, { userRefreshRateSeconds: 600 });
        const sourceFeed = (await ctx.findById(source.id))!;

        await ctx.service.copySettings({
          sourceFeed,
          dto: {
            targetFeedIds: [
              platformTarget.id,
              regularTarget.id,
              redditTarget.id,
            ],
            settings: [UserFeedCopyableSetting.RefreshRate],
            targetFeedSelectionType:
              UserFeedTargetFeedSelectionType.Selected,
          },
          discordUserId: ctx.discordUserId,
        });

        const platform = await ctx.findById(platformTarget.id);
        const regular = await ctx.findById(regularTarget.id);
        const reddit = await ctx.findById(redditTarget.id);
        assert.ok(!platform?.userRefreshRateSeconds);
        assert.strictEqual(regular?.userRefreshRateSeconds, 600);
        assert.strictEqual(reddit?.userRefreshRateSeconds, 600);
      });

      it("copies an at-floor source rate to platform and reddit targets", async () => {
        const ctx = await harness.createContext(floorSupporterOptions);

        const platformTarget = await addOtherPlatform(ctx);
        const redditTarget = await ctx.createFeed({ url: REDDIT_URL });
        await ctx.setFields(redditTarget.id, { isMeteredPlatformFeed: true });
        const source = await ctx.createFeed({});
        await ctx.setFields(source.id, {
          userRefreshRateSeconds: FLOOR_SECONDS,
        });
        const sourceFeed = (await ctx.findById(source.id))!;

        await ctx.service.copySettings({
          sourceFeed,
          dto: {
            targetFeedIds: [platformTarget.id, redditTarget.id],
            settings: [UserFeedCopyableSetting.RefreshRate],
            targetFeedSelectionType: UserFeedTargetFeedSelectionType.Selected,
          },
          discordUserId: ctx.discordUserId,
        });

        const platform = await ctx.findById(platformTarget.id);
        const reddit = await ctx.findById(redditTarget.id);
        assert.strictEqual(platform?.userRefreshRateSeconds, FLOOR_SECONDS);
        assert.strictEqual(reddit?.userRefreshRateSeconds, FLOOR_SECONDS);
      });
    });

    // Stitches the two halves the other suites exercise separately: the real
    // addFeed path (hash-stamped slot offset) into the real scheduler
    // aggregate, which is what actually triggers production fetches.
    describe("scheduling seam", () => {
      it("emits a premium feed created through addFeed on its rate bucket", async () => {
        const ctx = await harness.createContext({
          ...flaggedSupporterOptions,
          refreshRateSeconds: 120,
        });

        const feed = await addReddit(ctx);
        // Scheduled emission only selects feeds with an enabled connection.
        await ctx.setFields(feed.id, {
          connections: {
            discordChannels: [createMockDiscordChannelConnection()],
            discordWebhooks: [],
          },
        });

        const stored = await ctx.findById(feed.id);
        assert.ok(stored?.slotOffsetMs != null, "addFeed stamps a slot offset");
        const scheduleHandler = new ScheduleHandlerService(
          {
            // The feed carries a lookup key and the harness credential, so
            // fetch resolution needs the decryption key to attach the token.
            config: { BACKEND_API_ENCRYPTION_KEY_HEX: ctx.encryptionKey },
            supportersService: {},
            userFeedsService: ctx.service,
            usersService: {},
            userFeedRepository: ctx.userFeedRepository,
            messageBrokerService: {},
            // Anchor the slot window on the feed's own offset so the single
            // pass covers it, mirroring the emitter's steady-state cadence.
            now: () => stored.slotOffsetMs!,
            feedFetcherApiService: {},
          } as unknown as ConstructorParameters<
            typeof ScheduleHandlerService
          >[0],
        );

        const captured: Array<{ url: string; lookupKey?: string }> = [];
        await scheduleHandler.handleRefreshRate(stored.refreshRateSeconds!, {
          urlsHandler: async (batch) => {
            captured.push(...batch);
          },
        });

        const item = captured.find((entry) => entry.url === stored.url);
        assert.ok(item, "the feed must be emitted on its rate bucket");
      });
    });
  });

  describe("deleteFeedById", () => {
    it("deletes feed and returns deleted document", async () => {
      const ctx = await harness.createContext();
      const feed = await ctx.createFeed({ title: "To Delete" });

      const result = await ctx.service.deleteFeedById(feed.id);

      assert.ok(result);
      assert.strictEqual(result.id, feed.id);

      const found = await ctx.findById(feed.id);
      assert.strictEqual(found, null);
    });

    it("returns null when feed not found", async () => {
      const ctx = await harness.createContext();
      const fakeId = ctx.generateId();

      const result = await ctx.service.deleteFeedById(fakeId);

      assert.strictEqual(result, null);
    });
  });

  describe("bulkDelete", () => {
    it("deletes multiple feeds and returns status", async () => {
      const ctx = await harness.createContext();
      const feed1 = await ctx.createFeed({ title: "Feed 1" });
      const feed2 = await ctx.createFeed({ title: "Feed 2" });
      const fakeId = ctx.generateId();

      const result = await ctx.service.bulkDelete([feed1.id, feed2.id, fakeId]);

      assert.strictEqual(result.length, 3);
      assert.ok(result.find((r) => r.id === feed1.id)?.deleted);
      assert.ok(result.find((r) => r.id === feed2.id)?.deleted);
      assert.ok(!result.find((r) => r.id === fakeId)?.deleted);
    });

    it("publishes deleted-feed events with bounded concurrency", async () => {
      let activePublishes = 0;
      let peakPublishes = 0;
      const ctx = await harness.createContext({
        publishMessage: async () => {
          activePublishes += 1;
          peakPublishes = Math.max(peakPublishes, activePublishes);
          await new Promise((resolve) => setTimeout(resolve, 5));
          activePublishes -= 1;
        },
      });
      const feeds = await Promise.all(
        Array.from({ length: 11 }, (_, index) =>
          ctx.createFeed({ title: `Feed ${index}` }),
        ),
      );

      await ctx.service.bulkDelete(feeds.map((feed) => feed.id));

      assert.ok(peakPublishes > 1);
      assert.ok(peakPublishes <= 10);
    });
  });

  describe("bulkDisable", () => {
    it("disables multiple feeds", async () => {
      const ctx = await harness.createContext();
      const feed1 = await ctx.createFeed({ title: "Feed 1" });
      const feed2 = await ctx.createFeed({ title: "Feed 2" });

      const result = await ctx.service.bulkDisable([feed1.id, feed2.id]);

      assert.strictEqual(result.length, 2);
      assert.ok(result.find((r) => r.id === feed1.id)?.disabled);
      assert.ok(result.find((r) => r.id === feed2.id)?.disabled);

      const updated1 = await ctx.findById(feed1.id);
      const updated2 = await ctx.findById(feed2.id);
      assert.strictEqual(updated1?.disabledCode, UserFeedDisabledCode.Manual);
      assert.strictEqual(updated2?.disabledCode, UserFeedDisabledCode.Manual);
    });

    it("skips already disabled feeds with non-manual code", async () => {
      const ctx = await harness.createContext();
      const feed = await ctx.createFeed({});
      await ctx.setDisabledCode(feed.id, UserFeedDisabledCode.BadFormat);

      const result = await ctx.service.bulkDisable([feed.id]);

      assert.strictEqual(result.length, 1);
      assert.ok(!result[0]!.disabled);
    });
  });

  describe("bulkEnable", () => {
    it("enables multiple manually disabled feeds", async () => {
      const ctx = await harness.createContext();
      const feed1 = await ctx.createFeed({ title: "Feed 1" });
      const feed2 = await ctx.createFeed({ title: "Feed 2" });

      await ctx.setDisabledCode(feed1.id, UserFeedDisabledCode.Manual);
      await ctx.setDisabledCode(feed2.id, UserFeedDisabledCode.Manual);

      const result = await ctx.service.bulkEnable([feed1.id, feed2.id]);

      assert.strictEqual(result.length, 2);
      assert.ok(result.find((r) => r.id === feed1.id)?.enabled);
      assert.ok(result.find((r) => r.id === feed2.id)?.enabled);

      const updated1 = await ctx.findById(feed1.id);
      const updated2 = await ctx.findById(feed2.id);
      assert.strictEqual(updated1?.disabledCode, undefined);
      assert.strictEqual(updated2?.disabledCode, undefined);
    });

    it("does not enable feeds disabled for other reasons", async () => {
      const ctx = await harness.createContext();
      const feed = await ctx.createFeed({});
      await ctx.setDisabledCode(feed.id, UserFeedDisabledCode.BadFormat);

      const result = await ctx.service.bulkEnable([feed.id]);

      assert.strictEqual(result.length, 1);
      assert.ok(!result[0]!.enabled);

      const updated = await ctx.findById(feed.id);
      assert.strictEqual(updated?.disabledCode, UserFeedDisabledCode.BadFormat);
    });
  });

  describe("addFeed", () => {
    it("creates a new feed with correct properties", async () => {
      const ctx = await harness.createContext({
        feedHandler: {
          url: "https://example.com/feed.xml",
          articles: [{ date: new Date().toISOString() }],
          feedTitle: "Test Feed Title",
        },
      });

      const result = await ctx.service.addFeed(
        { discordUserId: ctx.discordUserId, userAccessToken: "token" },
        { url: "https://example.com/feed.xml" },
      );

      assert.ok(result);
      assert.strictEqual(result.url, "https://example.com/feed.xml");
      assert.strictEqual(result.user.discordUserId, ctx.discordUserId);
      assert.strictEqual(result.refreshRateSeconds, TEST_REFRESH_RATE_SECONDS);
      assert.strictEqual(result.maxDailyArticles, TEST_MAX_DAILY_ARTICLES);
      assert.ok(typeof result.slotOffsetMs === "number");
    });

    it("does not set feedRequestLookupKey for non-Reddit feeds", async () => {
      const ctx = await harness.createContext({
        feedHandler: { url: "https://example.com/feed.xml" },
      });

      const result = await ctx.service.addFeed(
        { discordUserId: ctx.discordUserId, userAccessToken: "token" },
        { url: "https://example.com/feed.xml" },
      );

      assert.strictEqual(result.feedRequestLookupKey, undefined);
    });

    it("throws FeedLimitReachedException when user has reached max feeds", async () => {
      const ctx = await harness.createContext({
        feedHandler: { url: "https://example.com/feed.xml" },
      });

      await ctx.createMany(TEST_MAX_USER_FEEDS);

      await assert.rejects(
        () =>
          ctx.service.addFeed(
            { discordUserId: ctx.discordUserId, userAccessToken: "token" },
            { url: "https://example.com/new.xml" },
          ),
        FeedLimitReachedException,
      );
    });

    it("copies settings from source feed when sourceFeedId is provided", async () => {
      const ctx = await harness.createContext({
        feedHandler: {
          url: "https://example.com/new.xml",
          feedTitle: "New Feed",
        },
      });

      const sourceFeed = await ctx.createFeed({ title: "Source Feed" });
      await ctx.setFields(sourceFeed.id, {
        passingComparisons: ["title", "description"],
        blockingComparisons: ["author"],
        formatOptions: { dateFormat: "YYYY-MM-DD" },
      });

      const result = await ctx.service.addFeed(
        { discordUserId: ctx.discordUserId, userAccessToken: "token" },
        { url: "https://example.com/new.xml", sourceFeedId: sourceFeed.id },
      );

      assert.deepStrictEqual(result.passingComparisons, [
        "title",
        "description",
      ]);
      assert.deepStrictEqual(result.blockingComparisons, ["author"]);
      assert.strictEqual(result.formatOptions?.dateFormat, "YYYY-MM-DD");
    });

    it("throws SourceFeedNotFoundException when sourceFeedId not found", async () => {
      const ctx = await harness.createContext({
        feedHandler: { url: "https://example.com/feed.xml" },
      });

      const fakeSourceId = ctx.generateId();

      await assert.rejects(
        () =>
          ctx.service.addFeed(
            { discordUserId: ctx.discordUserId, userAccessToken: "token" },
            { url: "https://example.com/new.xml", sourceFeedId: fakeSourceId },
          ),
        SourceFeedNotFoundException,
      );
    });

    it("sets dateCheckOptions when feed has articles with dates", async () => {
      const ctx = await harness.createContext({
        feedHandler: {
          url: "https://example.com/feed.xml",
          articles: [{ date: new Date().toISOString() }],
          feedTitle: "Feed with dates",
        },
      });

      const result = await ctx.service.addFeed(
        { discordUserId: ctx.discordUserId, userAccessToken: "token" },
        { url: "https://example.com/feed.xml" },
      );

      assert.ok(result.dateCheckOptions?.oldArticleDateDiffMsThreshold);
    });

    it("sets inputUrl when URL resolves to different final URL", async () => {
      const inputUrl = "https://example.com/page.html";
      const resolvedUrl = "https://example.com/feed.xml";

      const ctx = await harness.createContext({
        feedHandler: { url: resolvedUrl, feedTitle: "Resolved Feed" },
      });

      const result = await ctx.service.addFeed(
        { discordUserId: ctx.discordUserId, userAccessToken: "token" },
        { url: inputUrl },
      );

      assert.strictEqual(result.url, resolvedUrl);
      assert.strictEqual(result.inputUrl, inputUrl);
    });

    it("throws BannedFeedException if feed is banned", async () => {
      const ctx = await harness.createContext({
        bannedFeedDetails: { reason: "spam" },
        feedHandler: { url: "https://banned.com/feed.xml" },
      });

      await assert.rejects(
        () =>
          ctx.service.addFeed(
            { discordUserId: ctx.discordUserId, userAccessToken: "token" },
            { url: "https://banned.com/feed.xml" },
          ),
        BannedFeedException,
      );
    });

    it("throws if getArticles throws an error", async () => {
      const testError = new Error("feed fetch error");
      const ctx = await harness.createContext({
        feedHandler: { getArticlesError: testError },
      });

      await assert.rejects(
        () =>
          ctx.service.addFeed(
            { discordUserId: ctx.discordUserId, userAccessToken: "token" },
            { url: "https://example.com/feed.xml" },
          ),
        (err: Error) => {
          assert.strictEqual(err.message, testError.message);
          return true;
        },
      );
    });
  });

  describe("updateFeedById", () => {
    it("updates feed title", async () => {
      const ctx = await harness.createContext();
      const feed = await ctx.createFeed({ title: "Original Title" });

      const result = await ctx.service.updateFeedById(
        { id: feed.id },
        { title: "New Title" },
      );

      assert.ok(result);
      assert.strictEqual(result.title, "New Title");
    });

    it("updates passingComparisons", async () => {
      const ctx = await harness.createContext();
      const feed = await ctx.createFeed({});

      const result = await ctx.service.updateFeedById(
        { id: feed.id },
        { passingComparisons: ["title", "description"] },
      );

      assert.ok(result);
      assert.deepStrictEqual(result.passingComparisons, [
        "title",
        "description",
      ]);
    });

    it("updates blockingComparisons", async () => {
      const ctx = await harness.createContext();
      const feed = await ctx.createFeed({});

      const result = await ctx.service.updateFeedById(
        { id: feed.id },
        { blockingComparisons: ["author"] },
      );

      assert.ok(result);
      assert.deepStrictEqual(result.blockingComparisons, ["author"]);
    });

    it("replaces formatOptions entirely", async () => {
      const ctx = await harness.createContext();
      const feed = await ctx.createFeed({});
      await ctx.setFields(feed.id, {
        formatOptions: { dateFormat: "YYYY", dateTimezone: "UTC" },
      });

      const result = await ctx.service.updateFeedById(
        { id: feed.id },
        { formatOptions: { dateFormat: "MM-DD-YYYY" } },
      );

      assert.ok(result);
      assert.strictEqual(result.formatOptions?.dateFormat, "MM-DD-YYYY");
      assert.strictEqual(result.formatOptions?.dateTimezone, undefined);
    });

    it("disables feed manually", async () => {
      const ctx = await harness.createContext();
      const feed = await ctx.createFeed({});

      const result = await ctx.service.updateFeedById(
        { id: feed.id },
        { disabledCode: UserFeedDisabledCode.Manual },
      );

      assert.ok(result);
      assert.strictEqual(result.disabledCode, UserFeedDisabledCode.Manual);
    });

    it("enables manually disabled feed", async () => {
      const ctx = await harness.createContext();
      const feed = await ctx.createFeed({});
      await ctx.setDisabledCode(feed.id, UserFeedDisabledCode.Manual);

      const result = await ctx.service.updateFeedById(
        { id: feed.id },
        { disabledCode: null },
      );

      assert.ok(result);
      assert.strictEqual(result.disabledCode, undefined);
    });

    it("throws FeedLimitReachedException when enabling feed would exceed limit", async () => {
      const ctx = await harness.createContext();

      await ctx.createMany(TEST_MAX_USER_FEEDS);
      const disabledFeed = await ctx.createDisabled(
        UserFeedDisabledCode.ExceededFeedLimit,
      );

      await assert.rejects(
        () =>
          ctx.service.updateFeedById(
            {
              id: disabledFeed.id,
              disabledCode: UserFeedDisabledCode.ExceededFeedLimit,
            },
            { disabledCode: null },
          ),
        FeedLimitReachedException,
      );
    });

    it("throws error when feed not found", async () => {
      const ctx = await harness.createContext();
      const fakeId = ctx.generateId();

      await assert.rejects(
        () =>
          ctx.service.updateFeedById({ id: fakeId }, { title: "New Title" }),
        /not found/,
      );
    });

    it("updates URL and recalculates slotOffsetMs", async () => {
      let publishedMessage: unknown = null;
      const ctx = await harness.createContext({
        feedHandler: {
          url: "https://example.com/new.xml",
          feedTitle: "New Feed",
        },
        publishMessage: async (_queue, msg) => {
          publishedMessage = msg;
        },
      });

      const feed = await ctx.createFeed({});

      const result = await ctx.service.updateFeedById(
        { id: feed.id },
        { url: "https://example.com/new.xml" },
      );

      assert.ok(result);
      assert.strictEqual(result.url, "https://example.com/new.xml");
      assert.ok(typeof result.slotOffsetMs === "number");
      assert.ok(publishedMessage);
    });

    it("publishes feed-deleted message when URL changes", async () => {
      let publishedQueue: string | null = null;
      let publishedMessage: unknown = null;
      const ctx = await harness.createContext({
        feedHandler: { url: "https://example.com/new.xml" },
        publishMessage: async (queue, msg) => {
          publishedQueue = queue;
          publishedMessage = msg;
        },
      });

      const feed = await ctx.createFeed({});

      await ctx.service.updateFeedById(
        { id: feed.id },
        { url: "https://example.com/new.xml" },
      );

      assert.strictEqual(publishedQueue, "feed.deleted");
      assert.deepStrictEqual(publishedMessage, {
        data: { feedId: feed.id },
      });
    });

    it("allows changing a feed's URL to a reddit url without an active connection", async () => {
      const ctx = await harness.createContext({
        redditClientId: "test-reddit-client-id",
        feedHandler: {
          url: "https://www.reddit.com/r/gaming/.rss",
          feedTitle: "gaming",
        },
      });
      const feed = await ctx.createFeed({});

      const result = await ctx.service.updateFeedById(
        { id: feed.id },
        { url: "https://www.reddit.com/r/gaming/.rss" },
      );

      assert.ok(result);
      assert.strictEqual(result.url, "https://www.reddit.com/r/gaming/.rss");
    });

    it("throws BannedFeedException if URL resolves to a banned feed", async () => {
      const ctx = await harness.createContext({
        bannedFeedDetails: { reason: "spam" },
        feedHandler: { url: "https://banned.com/feed.xml" },
      });
      const feed = await ctx.createFeed({});

      await assert.rejects(
        () =>
          ctx.service.updateFeedById(
            { id: feed.id },
            { url: "https://banned.com/feed.xml" },
          ),
        BannedFeedException,
      );
    });

    it("throws if fetch feed throws when updating URL", async () => {
      const testError = new Error("feed fetch error");
      const ctx = await harness.createContext({
        feedHandler: { getArticlesError: testError },
      });
      const feed = await ctx.createFeed({});

      await assert.rejects(
        () =>
          ctx.service.updateFeedById(
            { id: feed.id },
            { url: "https://example.com/new.xml" },
          ),
        (err: Error) => {
          assert.strictEqual(err.message, testError.message);
          return true;
        },
      );
    });

    it("unsets userRefreshRateSeconds if it equals the user's default rate", async () => {
      const userDefaultRate = 600;
      const ctx = await harness.createContext({
        refreshRateSeconds: userDefaultRate,
      });
      const feed = await ctx.createFeed({});
      await ctx.setFields(feed.id, { userRefreshRateSeconds: 1200 });

      const result = await ctx.service.updateFeedById(
        { id: feed.id },
        { userRefreshRateSeconds: userDefaultRate },
      );

      assert.ok(result);
      assert.strictEqual(result.userRefreshRateSeconds, undefined);
    });

    it("sets userRefreshRateSeconds if it is slower than the user's default rate", async () => {
      const userDefaultRate = 600;
      const slowerRate = 1200;
      const ctx = await harness.createContext({
        refreshRateSeconds: userDefaultRate,
      });
      const feed = await ctx.createFeed({});

      const result = await ctx.service.updateFeedById(
        { id: feed.id },
        { userRefreshRateSeconds: slowerRate },
      );

      assert.ok(result);
      assert.strictEqual(result.userRefreshRateSeconds, slowerRate);
    });

    it("throws RefreshRateNotAllowedException if refresh rate is faster than allowed", async () => {
      const userDefaultRate = 600;
      const fasterRate = 300;
      const ctx = await harness.createContext({
        refreshRateSeconds: userDefaultRate,
      });
      const feed = await ctx.createFeed({});

      await assert.rejects(
        () =>
          ctx.service.updateFeedById(
            { id: feed.id },
            { userRefreshRateSeconds: fasterRate },
          ),
        RefreshRateNotAllowedException,
      );
    });

    it("does not update anything if no updates are provided", async () => {
      const ctx = await harness.createContext();
      const feed = await ctx.createFeed({ title: "Original Title" });
      await ctx.setFields(feed.id, {
        passingComparisons: ["original"],
        formatOptions: { dateFormat: "YYYY" },
      });

      const result = await ctx.service.updateFeedById({ id: feed.id }, {});

      assert.ok(result);
      assert.strictEqual(result.title, "Original Title");
      assert.deepStrictEqual(result.passingComparisons, ["original"]);
      assert.strictEqual(result.formatOptions?.dateFormat, "YYYY");
    });
  });

  describe("validateFeedUrl", () => {
    it("returns resolved URL when different from input", async () => {
      const inputUrl = "https://example.com/page.html";
      const resolvedUrl = "https://example.com/feed.xml";

      const ctx = await harness.createContext({
        feedHandler: { url: resolvedUrl, feedTitle: "Test Feed" },
      });

      const result = await ctx.service.validateFeedUrl(
        { discordUserId: ctx.discordUserId },
        { url: inputUrl },
      );

      assert.strictEqual(result.resolvedToUrl, resolvedUrl);
    });

    it("returns null resolvedToUrl when URL is same as input", async () => {
      const url = "https://example.com/feed.xml";

      const ctx = await harness.createContext({
        feedHandler: { url, feedTitle: "Test Feed" },
      });

      const result = await ctx.service.validateFeedUrl(
        { discordUserId: ctx.discordUserId },
        { url },
      );

      assert.strictEqual(result.resolvedToUrl, null);
    });

    it("returns feedTitle when available", async () => {
      const ctx = await harness.createContext({
        feedHandler: {
          url: "https://example.com/feed.xml",
          feedTitle: "My Awesome Feed",
        },
      });

      const result = await ctx.service.validateFeedUrl(
        { discordUserId: ctx.discordUserId },
        { url: "https://example.com/feed.xml" },
      );

      assert.strictEqual(result.feedTitle, "My Awesome Feed");
    });

    it("uses platform provider routing during URL validation", async () => {
      let capturedInput: GetArticlesInput | null = null;
      const ctx = await harness.createContext({
        feedHandler: {
          url: "https://www.instagram.com/adrienbrody",
          feedTitle: "Instagram @adrienbrody posts",
          onGetArticles: (input) => {
            capturedInput = input;
          },
        },
      });

      await ctx.service.validateFeedUrl(
        { discordUserId: ctx.discordUserId },
        { url: "https://www.instagram.com/adrienbrody" },
      );

      assert.strictEqual(capturedInput?.usePlatformProvider, true);
    });
  });

  describe("enforceUserFeedLimit", () => {
    describe("supporter limits", () => {
      it("disables feeds when supporter exceeds their limit", async () => {
        const ctx = await harness.createContext({
          isSupporter: true,
          maxUserFeeds: 2,
        });

        const feed1 = await ctx.createFeed({ title: "Feed 1" });
        const feed2 = await ctx.createFeed({ title: "Feed 2" });
        const feed3 = await ctx.createFeed({ title: "Feed 3" });

        await ctx.setCreatedAt(feed1.id, new Date("2020-01-01"));
        await ctx.setCreatedAt(feed2.id, new Date("2021-01-01"));
        await ctx.setCreatedAt(feed3.id, new Date("2022-01-01"));

        await ctx.service.deleteFeedById(feed3.id);

        const updated1 = await ctx.findById(feed1.id);
        const updated2 = await ctx.findById(feed2.id);

        assert.strictEqual(updated1?.disabledCode, undefined);
        assert.strictEqual(updated2?.disabledCode, undefined);
      });

      it("disables oldest feeds first when over limit", async () => {
        const ctx = await harness.createContext({
          isSupporter: true,
          maxUserFeeds: 2,
        });

        const feed1 = await ctx.createFeed({ title: "Oldest Feed" });
        const feed2 = await ctx.createFeed({ title: "Middle Feed" });
        const feed3 = await ctx.createFeed({ title: "Newest Feed" });

        await ctx.setCreatedAt(feed1.id, new Date("2020-01-01"));
        await ctx.setCreatedAt(feed2.id, new Date("2021-01-01"));
        await ctx.setCreatedAt(feed3.id, new Date("2022-01-01"));

        await ctx.service.bulkDisable([feed1.id]);

        const updated1 = await ctx.findById(feed1.id);
        const updated2 = await ctx.findById(feed2.id);
        const updated3 = await ctx.findById(feed3.id);

        assert.strictEqual(updated1?.disabledCode, UserFeedDisabledCode.Manual);
        assert.strictEqual(updated2?.disabledCode, undefined);
        assert.strictEqual(updated3?.disabledCode, undefined);
      });

      it("does not disable feeds when at or under limit", async () => {
        const ctx = await harness.createContext({
          isSupporter: true,
          maxUserFeeds: 3,
        });

        const feed1 = await ctx.createFeed({ title: "Feed 1" });
        const feed2 = await ctx.createFeed({ title: "Feed 2" });

        await ctx.service.bulkDisable([feed1.id]);
        await ctx.service.bulkEnable([feed1.id]);

        const updated1 = await ctx.findById(feed1.id);
        const updated2 = await ctx.findById(feed2.id);

        assert.strictEqual(updated1?.disabledCode, undefined);
        assert.strictEqual(updated2?.disabledCode, undefined);
      });

      it("does not enable manually disabled feeds when under limit", async () => {
        const ctx = await harness.createContext({
          isSupporter: true,
          maxUserFeeds: 5,
        });

        const feed1 = await ctx.createFeed({ title: "Feed 1" });
        await ctx.setDisabledCode(feed1.id, UserFeedDisabledCode.Manual);

        await ctx.service.bulkDisable([feed1.id]);

        const updated = await ctx.findById(feed1.id);
        assert.strictEqual(updated?.disabledCode, UserFeedDisabledCode.Manual);
      });

      it("does not enable feeds disabled for other reasons when under limit", async () => {
        const ctx = await harness.createContext({
          isSupporter: true,
          maxUserFeeds: 5,
        });

        const feed = await ctx.createFeed({ title: "Bad Format Feed" });
        await ctx.setDisabledCode(feed.id, UserFeedDisabledCode.BadFormat);

        await ctx.service.deleteFeedById((await ctx.createFeed({})).id);

        const updated = await ctx.findById(feed.id);
        assert.strictEqual(
          updated?.disabledCode,
          UserFeedDisabledCode.BadFormat,
        );
      });

      it("re-enables ExceededFeedLimit feeds when deleting brings user under limit", async () => {
        const ctx = await harness.createContext({
          isSupporter: true,
          maxUserFeeds: TEST_MAX_USER_FEEDS,
        });

        const feeds = await ctx.createMany(TEST_MAX_USER_FEEDS);
        const disabledFeed = await ctx.createDisabled(
          UserFeedDisabledCode.ExceededFeedLimit,
        );

        await ctx.service.deleteFeedById(feeds[0]!.id);

        const updated = await ctx.findById(disabledFeed.id);
        assert.strictEqual(updated?.disabledCode, undefined);
      });

      it("re-enables newest disabled feeds first when under limit", async () => {
        const ctx = await harness.createContext({
          isSupporter: true,
          maxUserFeeds: 2,
        });

        const oldDisabled = await ctx.createDisabled(
          UserFeedDisabledCode.ExceededFeedLimit,
        );
        const newDisabled = await ctx.createDisabled(
          UserFeedDisabledCode.ExceededFeedLimit,
        );

        await ctx.setCreatedAt(oldDisabled.id, new Date("2020-01-01"));
        await ctx.setCreatedAt(newDisabled.id, new Date("2022-01-01"));

        await ctx.service.bulkEnable([oldDisabled.id]);

        const updatedOld = await ctx.findById(oldDisabled.id);
        const updatedNew = await ctx.findById(newDisabled.id);

        assert.strictEqual(updatedOld?.disabledCode, undefined);
        assert.strictEqual(updatedNew?.disabledCode, undefined);
      });
    });

    describe("non-supporter (default) limits", () => {
      it("disables feeds when non-supporter exceeds default limit", async () => {
        const ctx = await harness.createContext({
          isSupporter: false,
          maxUserFeeds: 2,
          defaultMaxUserFeeds: 2,
        });

        const feed1 = await ctx.createFeed({ title: "Feed 1" });
        const feed2 = await ctx.createFeed({ title: "Feed 2" });
        const feed3 = await ctx.createFeed({ title: "Feed 3" });

        await ctx.setCreatedAt(feed1.id, new Date("2020-01-01"));
        await ctx.setCreatedAt(feed2.id, new Date("2021-01-01"));
        await ctx.setCreatedAt(feed3.id, new Date("2022-01-01"));

        await ctx.service.bulkDisable([feed3.id]);
        await ctx.service.bulkEnable([feed3.id]);

        const updated1 = await ctx.findById(feed1.id);
        const updated2 = await ctx.findById(feed2.id);
        const updated3 = await ctx.findById(feed3.id);

        assert.strictEqual(
          updated1?.disabledCode,
          UserFeedDisabledCode.ExceededFeedLimit,
        );
        assert.strictEqual(updated2?.disabledCode, undefined);
        assert.strictEqual(updated3?.disabledCode, undefined);
      });

      it("enables feeds when non-supporter is under default limit", async () => {
        const ctx = await harness.createContext({
          isSupporter: false,
          maxUserFeeds: 3,
          defaultMaxUserFeeds: 3,
        });

        const feed1 = await ctx.createFeed({ title: "Enabled Feed" });
        const feed2 = await ctx.createDisabled(
          UserFeedDisabledCode.ExceededFeedLimit,
        );
        const feed3 = await ctx.createDisabled(
          UserFeedDisabledCode.ExceededFeedLimit,
        );

        await ctx.setCreatedAt(feed2.id, new Date("2020-01-01"));
        await ctx.setCreatedAt(feed3.id, new Date("2022-01-01"));

        await ctx.service.deleteFeedById(feed1.id);

        const updated2 = await ctx.findById(feed2.id);
        const updated3 = await ctx.findById(feed3.id);

        assert.strictEqual(updated2?.disabledCode, undefined);
        assert.strictEqual(updated3?.disabledCode, undefined);
      });

      it("does not enable feeds disabled for other reasons when under limit", async () => {
        const ctx = await harness.createContext({
          isSupporter: false,
          maxUserFeeds: 5,
          defaultMaxUserFeeds: 5,
        });

        const feed = await ctx.createFeed({});
        await ctx.setDisabledCode(feed.id, UserFeedDisabledCode.FailedRequests);

        await ctx.service.deleteFeedById((await ctx.createFeed({})).id);

        const updated = await ctx.findById(feed.id);
        assert.strictEqual(
          updated?.disabledCode,
          UserFeedDisabledCode.FailedRequests,
        );
      });

      it("treats manually disabled feeds as not counting against limit", async () => {
        const ctx = await harness.createContext({
          isSupporter: false,
          maxUserFeeds: 2,
          defaultMaxUserFeeds: 2,
        });

        const feed1 = await ctx.createFeed({ title: "Feed 1" });
        const feed2 = await ctx.createFeed({ title: "Feed 2" });
        await ctx.setDisabledCode(feed2.id, UserFeedDisabledCode.Manual);
        const feed3 = await ctx.createFeed({ title: "Feed 3" });

        await ctx.service.bulkDisable([feed3.id]);
        await ctx.service.bulkEnable([feed3.id]);

        const updated1 = await ctx.findById(feed1.id);
        const updated2 = await ctx.findById(feed2.id);
        const updated3 = await ctx.findById(feed3.id);

        assert.strictEqual(updated1?.disabledCode, undefined);
        assert.strictEqual(updated2?.disabledCode, UserFeedDisabledCode.Manual);
        assert.strictEqual(updated3?.disabledCode, undefined);
      });

      it("does not enable manually disabled feeds when under limit", async () => {
        const ctx = await harness.createContext({
          isSupporter: false,
          maxUserFeeds: 5,
          defaultMaxUserFeeds: 5,
        });

        const feed = await ctx.createDisabled(UserFeedDisabledCode.Manual);

        await ctx.service.deleteFeedById((await ctx.createFeed({})).id);

        const updated = await ctx.findById(feed.id);
        assert.strictEqual(updated?.disabledCode, UserFeedDisabledCode.Manual);
      });
    });

    describe("integration through various methods", () => {
      it("enforces limits after updateFeedById when disabledCode changes", async () => {
        const ctx = await harness.createContext({
          isSupporter: false,
          maxUserFeeds: 2,
          defaultMaxUserFeeds: 2,
        });

        const feed1 = await ctx.createFeed({ title: "Feed 1" });
        const feed2 = await ctx.createFeed({ title: "Feed 2" });
        const feed3 = await ctx.createDisabled(
          UserFeedDisabledCode.ExceededFeedLimit,
        );

        await ctx.setCreatedAt(feed1.id, new Date("2020-01-01"));
        await ctx.setCreatedAt(feed2.id, new Date("2021-01-01"));
        await ctx.setCreatedAt(feed3.id, new Date("2022-01-01"));

        await ctx.service.updateFeedById(
          { id: feed2.id },
          { disabledCode: UserFeedDisabledCode.Manual },
        );

        const updated3 = await ctx.findById(feed3.id);
        assert.strictEqual(updated3?.disabledCode, undefined);
      });

      it("enforces limits after deleteFeedById", async () => {
        const ctx = await harness.createContext({
          isSupporter: false,
          maxUserFeeds: 2,
          defaultMaxUserFeeds: 2,
        });

        const feed1 = await ctx.createFeed({ title: "Feed 1" });
        const feed2 = await ctx.createFeed({ title: "Feed 2" });
        const feed3 = await ctx.createDisabled(
          UserFeedDisabledCode.ExceededFeedLimit,
        );

        await ctx.service.deleteFeedById(feed1.id);

        const updated3 = await ctx.findById(feed3.id);
        assert.strictEqual(updated3?.disabledCode, undefined);
      });

      it("enforces limits after bulkDelete", async () => {
        const ctx = await harness.createContext({
          isSupporter: false,
          maxUserFeeds: 2,
          defaultMaxUserFeeds: 2,
        });

        const feed1 = await ctx.createFeed({ title: "Feed 1" });
        const feed2 = await ctx.createFeed({ title: "Feed 2" });
        const feed3 = await ctx.createDisabled(
          UserFeedDisabledCode.ExceededFeedLimit,
        );

        await ctx.service.bulkDelete([feed1.id]);

        const updated3 = await ctx.findById(feed3.id);
        assert.strictEqual(updated3?.disabledCode, undefined);
      });

      it("enforces limits after bulkDisable", async () => {
        const ctx = await harness.createContext({
          isSupporter: false,
          maxUserFeeds: 2,
          defaultMaxUserFeeds: 2,
        });

        const feed1 = await ctx.createFeed({ title: "Feed 1" });
        const feed2 = await ctx.createFeed({ title: "Feed 2" });
        const feed3 = await ctx.createDisabled(
          UserFeedDisabledCode.ExceededFeedLimit,
        );

        await ctx.setCreatedAt(feed3.id, new Date("2022-01-01"));

        await ctx.service.bulkDisable([feed1.id]);

        const updated3 = await ctx.findById(feed3.id);
        assert.strictEqual(updated3?.disabledCode, undefined);
      });

      it("enforces limits after bulkEnable", async () => {
        const ctx = await harness.createContext({
          isSupporter: false,
          maxUserFeeds: 2,
          defaultMaxUserFeeds: 2,
        });

        const feed1 = await ctx.createFeed({ title: "Feed 1" });
        const feed2 = await ctx.createFeed({ title: "Feed 2" });
        const feed3 = await ctx.createDisabled(UserFeedDisabledCode.Manual);

        await ctx.setCreatedAt(feed1.id, new Date("2020-01-01"));
        await ctx.setCreatedAt(feed2.id, new Date("2021-01-01"));
        await ctx.setCreatedAt(feed3.id, new Date("2022-01-01"));

        await ctx.service.bulkEnable([feed3.id]);

        const updated1 = await ctx.findById(feed1.id);
        assert.strictEqual(
          updated1?.disabledCode,
          UserFeedDisabledCode.ExceededFeedLimit,
        );
      });
    });

    describe("refresh rate enforcement", () => {
      it("unsets userRefreshRateSeconds when non-supporter has supporter rate set", async () => {
        const supporterRefreshRate = 120;
        const ctx = await harness.createContext({
          isSupporter: false,
          maxUserFeeds: 5,
          defaultMaxUserFeeds: 5,
          refreshRateSeconds: 600,
          defaultSupporterRefreshRateSeconds: supporterRefreshRate,
        });

        const feed = await ctx.createFeed({ title: "Feed 1" });
        await ctx.setFields(feed.id, {
          userRefreshRateSeconds: supporterRefreshRate,
        });

        await ctx.service.deleteFeedById((await ctx.createFeed({})).id);

        const updated = await ctx.findById(feed.id);
        assert.strictEqual(updated?.userRefreshRateSeconds, undefined);
      });

      it("does not unset userRefreshRateSeconds for supporter at supporter rate", async () => {
        const supporterRefreshRate = 120;
        const ctx = await harness.createContext({
          isSupporter: true,
          maxUserFeeds: 5,
          refreshRateSeconds: supporterRefreshRate,
          defaultSupporterRefreshRateSeconds: supporterRefreshRate,
        });

        const feed = await ctx.createFeed({ title: "Feed 1" });
        await ctx.setFields(feed.id, {
          userRefreshRateSeconds: supporterRefreshRate,
        });

        await ctx.service.deleteFeedById((await ctx.createFeed({})).id);

        const updated = await ctx.findById(feed.id);
        assert.strictEqual(
          updated?.userRefreshRateSeconds,
          supporterRefreshRate,
        );
      });
    });
  });

  describe("enforceWebhookConnections", () => {
    it("disables webhooks if the user is not a supporter", async () => {
      const ctx = await harness.createContext();
      const secondDiscordUserId = ctx.discordUserId + "2";
      const thirdDiscordUserId = ctx.discordUserId + "3";

      const feed1 = await ctx.createFeedWithConnections({
        discordUserId: ctx.discordUserId,
        title: "title1",
        connections: {
          discordChannels: [
            {
              ...createMockDiscordChannelConnection({
                details: {
                  webhook: {
                    id: "1",
                    guildId: "1",
                    token: "1",
                  },
                },
              }),
              disabledCode: FeedConnectionDisabledCode.MissingMedium,
            },
            {
              ...createMockDiscordChannelConnection({
                details: {
                  webhook: {
                    id: "1",
                    guildId: "1",
                    token: "1",
                  },
                },
              }),
            },
            {
              ...createMockDiscordChannelConnection(),
            },
          ],
        },
      });

      const feed2 = await ctx.createFeedWithConnections({
        discordUserId: secondDiscordUserId,
        title: "title2",
        connections: {
          discordChannels: [
            {
              ...createMockDiscordChannelConnection({
                details: {
                  webhook: {
                    id: "1",
                    guildId: "1",
                    token: "1",
                  },
                },
              }),
            },
          ],
        },
      });

      const feed3 = await ctx.createFeedWithConnections({
        discordUserId: thirdDiscordUserId,
        title: "title3",
        connections: {
          discordChannels: [
            {
              ...createMockDiscordChannelConnection({
                details: {
                  webhook: {
                    id: "1",
                    guildId: "1",
                    token: "1",
                  },
                },
              }),
            },
          ],
        },
      });

      await ctx.enforceWebhookConnections({
        type: "all-users",
        supporterDiscordUserIds: [secondDiscordUserId],
      });

      const updated1 = await ctx.findById(feed1.id);
      const updated2 = await ctx.findById(feed2.id);
      const updated3 = await ctx.findById(feed3.id);

      assert.ok(updated1);
      assert.ok(updated2);
      assert.ok(updated3);

      assert.strictEqual(
        updated1.connections?.discordChannels[0]?.disabledCode,
        FeedConnectionDisabledCode.NotPaidSubscriber,
      );
      assert.strictEqual(
        updated1.connections?.discordChannels[1]?.disabledCode,
        FeedConnectionDisabledCode.NotPaidSubscriber,
      );
      assert.strictEqual(
        updated1.connections?.discordChannels[2]?.disabledCode,
        FeedConnectionDisabledCode.NotPaidSubscriber,
      );

      assert.strictEqual(
        updated2.connections?.discordChannels[0]?.disabledCode,
        undefined,
      );

      assert.strictEqual(
        updated3.connections?.discordChannels[0]?.disabledCode,
        FeedConnectionDisabledCode.NotPaidSubscriber,
      );
    });

    it("does not disable manually-disabled webhook connections if user is not a supporter", async () => {
      const ctx = await harness.createContext();

      const feed = await ctx.createFeedWithConnections({
        discordUserId: ctx.discordUserId,
        title: "title1",
        connections: {
          discordChannels: [
            {
              ...createMockDiscordChannelConnection({
                disabledCode: FeedConnectionDisabledCode.Manual,
                details: {
                  webhook: {
                    id: "1",
                    guildId: "1",
                    token: "1",
                  },
                },
              }),
            },
          ],
        },
      });

      await ctx.enforceWebhookConnections({
        type: "single-user",
        discordUserId: ctx.discordUserId,
        allowWebhooks: false,
      });

      const updated = await ctx.findById(feed.id);

      assert.ok(updated);
      assert.strictEqual(
        updated.connections?.discordChannels[0]?.disabledCode,
        FeedConnectionDisabledCode.Manual,
      );
    });

    it("enables webhooks if the user is a supporter", async () => {
      const ctx = await harness.createContext();

      const feed = await ctx.createFeedWithConnections({
        discordUserId: ctx.discordUserId,
        title: "title1",
        connections: {
          discordChannels: [
            {
              ...createMockDiscordChannelConnection({
                disabledCode: FeedConnectionDisabledCode.NotPaidSubscriber,
                details: {
                  webhook: {
                    id: "1",
                    guildId: "1",
                    token: "1",
                  },
                },
              }),
            },
          ],
        },
      });

      await ctx.enforceWebhookConnections({
        type: "all-users",
        supporterDiscordUserIds: [ctx.discordUserId],
      });

      const updated = await ctx.findById(feed.id);

      assert.ok(updated);
      assert.strictEqual(
        updated.connections?.discordChannels[0]?.disabledCode,
        undefined,
      );
    });
  });

  describe("manuallyRequest", () => {
    it("throws ManualRequestTooSoonException when called too soon after last request", async () => {
      const ctx = await harness.createContext({
        feedFetcherApiService: { requestStatus: "SUCCESS" },
      });
      const feed = await ctx.createFeed({});
      await ctx.setFields(feed.id, {
        lastManualRequestAt: new Date(),
      });

      const updatedFeed = await ctx.findById(feed.id);
      assert.ok(updatedFeed);

      await assert.rejects(
        () => ctx.service.manuallyRequest(updatedFeed),
        ManualRequestTooSoonException,
      );
    });

    it("updates lastManualRequestAt on successful request", async () => {
      const ctx = await harness.createContext({
        feedFetcherApiService: { requestStatus: "SUCCESS" },
      });
      const feed = await ctx.createFeed({});
      const beforeRequest = new Date();

      await ctx.service.manuallyRequest(feed);

      const updated = await ctx.findById(feed.id);
      assert.ok(updated);
      assert.ok(updated.lastManualRequestAt);
      assert.ok(updated.lastManualRequestAt >= beforeRequest);
    });

    it("sets health status to Ok on successful request", async () => {
      const ctx = await harness.createContext({
        feedFetcherApiService: { requestStatus: "SUCCESS" },
      });
      const feed = await ctx.createFeed({});
      await ctx.setFields(feed.id, {
        healthStatus: UserFeedHealthStatus.Failed,
      });

      const feedToRequest = await ctx.findById(feed.id);
      assert.ok(feedToRequest);

      await ctx.service.manuallyRequest(feedToRequest);

      const updated = await ctx.findById(feed.id);
      assert.ok(updated);
      assert.strictEqual(updated.healthStatus, UserFeedHealthStatus.Ok);
    });

    it("returns requestStatus from the result", async () => {
      const ctx = await harness.createContext({
        feedFetcherApiService: { requestStatus: "SUCCESS" },
      });
      const feed = await ctx.createFeed({});

      const result = await ctx.service.manuallyRequest(feed);

      assert.strictEqual(result.requestStatus, "SUCCESS");
    });

    it("returns statusCode when request fails with bad status code", async () => {
      const ctx = await harness.createContext({
        feedFetcherApiService: {
          requestStatus: "BAD_STATUS_CODE",
          statusCode: 404,
        },
      });
      const feed = await ctx.createFeed({});

      const result = await ctx.service.manuallyRequest(feed);

      assert.strictEqual(result.requestStatus, "BAD_STATUS_CODE");
      assert.strictEqual(result.requestStatusCode, 404);
    });

    it("clears disabledCode when feed was disabled with InvalidFeed and request succeeds", async () => {
      const ctx = await harness.createContext({
        feedFetcherApiService: { requestStatus: "SUCCESS" },
        feedHandler: {
          requestStatus: GetArticlesResponseRequestStatus.Success,
        },
      });
      const feed = await ctx.createFeed({});
      await ctx.setFields(feed.id, {
        disabledCode: RepoUserFeedDisabledCode.InvalidFeed,
      });

      const feedToRequest = await ctx.findById(feed.id);
      assert.ok(feedToRequest);

      await ctx.service.manuallyRequest(feedToRequest);

      const updated = await ctx.findById(feed.id);
      assert.ok(updated);
      assert.strictEqual(updated.disabledCode, undefined);
    });

    it("does not clear disabledCode when article properties check fails", async () => {
      const ctx = await harness.createContext({
        feedFetcherApiService: { requestStatus: "SUCCESS" },
        feedHandler: {
          requestStatus: GetArticlesResponseRequestStatus.ParseError,
        },
      });
      const feed = await ctx.createFeed({});
      await ctx.setFields(feed.id, {
        disabledCode: RepoUserFeedDisabledCode.InvalidFeed,
      });

      const feedToRequest = await ctx.findById(feed.id);
      assert.ok(feedToRequest);

      await ctx.service.manuallyRequest(feedToRequest);

      const updated = await ctx.findById(feed.id);
      assert.ok(updated);
      assert.strictEqual(
        updated.disabledCode,
        RepoUserFeedDisabledCode.InvalidFeed,
      );
    });
  });

  describe("getFeedArticleProperties", () => {
    it("returns properties from articles", async () => {
      const ctx = await harness.createContext({
        feedHandler: {
          requestStatus: GetArticlesResponseRequestStatus.Success,
          articles: [
            { title: "Test", description: "Desc" },
            { title: "Test 2", author: "Someone" },
          ],
        },
      });
      const feed = await ctx.createFeed({});

      const result = await ctx.service.getFeedArticleProperties({
        feed,
        url: feed.url,
      });

      assert.ok(result.properties.includes("title"));
      assert.ok(result.properties.includes("description"));
      assert.ok(result.properties.includes("author"));
    });

    it("returns sorted unique properties", async () => {
      const ctx = await harness.createContext({
        feedHandler: {
          requestStatus: GetArticlesResponseRequestStatus.Success,
          articles: [
            { zebra: "z", apple: "a" },
            { apple: "a2", banana: "b" },
          ],
        },
      });
      const feed = await ctx.createFeed({});

      const result = await ctx.service.getFeedArticleProperties({
        feed,
        url: feed.url,
      });

      assert.deepStrictEqual(result.properties, ["apple", "banana", "zebra"]);
    });

    it("returns requestStatus from feed handler", async () => {
      const ctx = await harness.createContext({
        feedHandler: {
          requestStatus: GetArticlesResponseRequestStatus.Success,
          articles: [],
        },
      });
      const feed = await ctx.createFeed({});

      const result = await ctx.service.getFeedArticleProperties({
        feed,
        url: feed.url,
      });

      assert.strictEqual(
        result.requestStatus,
        GetArticlesResponseRequestStatus.Success,
      );
    });

    it("returns empty properties when no articles", async () => {
      const ctx = await harness.createContext({
        feedHandler: {
          requestStatus: GetArticlesResponseRequestStatus.Success,
          articles: [],
        },
      });
      const feed = await ctx.createFeed({});

      const result = await ctx.service.getFeedArticleProperties({
        feed,
        url: feed.url,
      });

      assert.deepStrictEqual(result.properties, []);
    });
  });

  describe("clone", () => {
    it("throws error when source feed not found", async () => {
      const ctx = await harness.createContext();
      const fakeId = ctx.generateId();

      await assert.rejects(
        () => ctx.service.clone(fakeId, "token"),
        /not found/,
      );
    });

    it("throws FeedLimitReachedException when user at max feeds", async () => {
      const ctx = await harness.createContext();

      const feeds = await ctx.createMany(TEST_MAX_USER_FEEDS);

      await assert.rejects(
        () => ctx.service.clone(feeds[0]!.id, "token"),
        FeedLimitReachedException,
      );
    });

    it("successfully clones feed with same URL", async () => {
      const ctx = await harness.createContext();
      const sourceFeed = await ctx.createFeed({
        title: "Original Feed",
        url: "https://example.com/original.xml",
      });

      const result = await ctx.service.clone(sourceFeed.id, "token");

      assert.ok(result.id);
      const clonedFeed = await ctx.findById(result.id);
      assert.ok(clonedFeed);
      assert.strictEqual(clonedFeed.url, sourceFeed.url);
      assert.strictEqual(clonedFeed.title, sourceFeed.title);
    });

    it("successfully clones feed with custom title", async () => {
      const ctx = await harness.createContext();
      const sourceFeed = await ctx.createFeed({ title: "Original" });

      const result = await ctx.service.clone(sourceFeed.id, "token", {
        title: "Cloned Feed",
      });

      const clonedFeed = await ctx.findById(result.id);
      assert.ok(clonedFeed);
      assert.strictEqual(clonedFeed.title, "Cloned Feed");
    });

    it("successfully clones feed with different URL", async () => {
      const newUrl = "https://example.com/new-feed.xml";
      const ctx = await harness.createContext({
        feedHandler: { url: newUrl, feedTitle: "New Feed" },
      });
      const sourceFeed = await ctx.createFeed({
        url: "https://example.com/original.xml",
      });

      const result = await ctx.service.clone(sourceFeed.id, "token", {
        url: newUrl,
      });

      const clonedFeed = await ctx.findById(result.id);
      assert.ok(clonedFeed);
      assert.strictEqual(clonedFeed.url, newUrl);
      assert.strictEqual(clonedFeed.inputUrl, newUrl);
    });

    it("cloned feed inherits settings from source", async () => {
      const ctx = await harness.createContext();
      const sourceFeed = await ctx.createFeed({});
      await ctx.setFields(sourceFeed.id, {
        passingComparisons: ["title", "description"],
        blockingComparisons: ["author"],
        formatOptions: { dateFormat: "YYYY-MM-DD" },
        dateCheckOptions: { oldArticleDateDiffMsThreshold: 86400000 },
      });

      const result = await ctx.service.clone(sourceFeed.id, "token");

      const clonedFeed = await ctx.findById(result.id);
      assert.ok(clonedFeed);
      assert.deepStrictEqual(clonedFeed.passingComparisons, [
        "title",
        "description",
      ]);
      assert.deepStrictEqual(clonedFeed.blockingComparisons, ["author"]);
      assert.strictEqual(clonedFeed.formatOptions?.dateFormat, "YYYY-MM-DD");
      assert.strictEqual(
        clonedFeed.dateCheckOptions?.oldArticleDateDiffMsThreshold,
        86400000,
      );
    });

    it("clones discord channel connections from source feed", async () => {
      const ctx = await harness.createContext();
      const sourceFeed = await ctx.createFeedWithConnections({
        title: "Source Feed",
        connections: {
          discordChannels: [
            createMockDiscordChannelConnection(),
            createMockDiscordChannelConnection(),
          ],
        },
      });

      await ctx.service.clone(sourceFeed.id, "token");

      assert.strictEqual(
        ctx.feedConnectionsDiscordChannelsService.cloneConnection.mock.callCount(),
        2,
      );
    });

    it("returns the new feed ID", async () => {
      const ctx = await harness.createContext();
      const sourceFeed = await ctx.createFeed({});

      const result = await ctx.service.clone(sourceFeed.id, "token");

      assert.ok(result.id);
      assert.ok(typeof result.id === "string");
      assert.ok(result.id.length > 0);
    });
  });

  describe("copySettings", () => {
    it("copies PassingComparisons to target feeds", async () => {
      const ctx = await harness.createContext();

      const sourceFeed = await ctx.createFeed({ title: "Source Feed" });
      await ctx.setFields(sourceFeed.id, {
        passingComparisons: ["title", "description"],
      });

      const targetFeed = await ctx.createFeed({ title: "Target Feed" });

      const updatedSource = await ctx.findById(sourceFeed.id);
      assert.ok(updatedSource);

      await ctx.service.copySettings({
        sourceFeed: updatedSource,
        dto: {
          settings: [UserFeedCopyableSetting.PassingComparisons],
          targetFeedIds: [targetFeed.id],
          targetFeedSelectionType: UserFeedTargetFeedSelectionType.Selected,
        },
        discordUserId: ctx.discordUserId,
      });

      const updated = await ctx.findById(targetFeed.id);
      assert.ok(updated);
      assert.deepStrictEqual(updated.passingComparisons, [
        "title",
        "description",
      ]);
    });

    it("copies BlockingComparisons to target feeds", async () => {
      const ctx = await harness.createContext();

      const sourceFeed = await ctx.createFeed({ title: "Source Feed" });
      await ctx.setFields(sourceFeed.id, {
        blockingComparisons: ["author", "link"],
      });

      const targetFeed = await ctx.createFeed({ title: "Target Feed" });

      const updatedSource = await ctx.findById(sourceFeed.id);
      assert.ok(updatedSource);

      await ctx.service.copySettings({
        sourceFeed: updatedSource,
        dto: {
          settings: [UserFeedCopyableSetting.BlockingComparisons],
          targetFeedIds: [targetFeed.id],
          targetFeedSelectionType: UserFeedTargetFeedSelectionType.Selected,
        },
        discordUserId: ctx.discordUserId,
      });

      const updated = await ctx.findById(targetFeed.id);
      assert.ok(updated);
      assert.deepStrictEqual(updated.blockingComparisons, ["author", "link"]);
    });

    it("copies ExternalProperties with new IDs", async () => {
      const ctx = await harness.createContext();

      const sourceFeed = await ctx.createFeed({ title: "Source Feed" });
      const sourcePropertyId = ctx.generateId();
      await ctx.setFields(sourceFeed.id, {
        externalProperties: [
          {
            id: sourcePropertyId,
            sourceField: "description",
            cssSelector: ".content",
            label: "Content",
          },
        ],
      });

      const targetFeed = await ctx.createFeed({ title: "Target Feed" });

      const updatedSource = await ctx.findById(sourceFeed.id);
      assert.ok(updatedSource);

      await ctx.service.copySettings({
        sourceFeed: updatedSource,
        dto: {
          settings: [UserFeedCopyableSetting.ExternalProperties],
          targetFeedIds: [targetFeed.id],
          targetFeedSelectionType: UserFeedTargetFeedSelectionType.Selected,
        },
        discordUserId: ctx.discordUserId,
      });

      const updated = await ctx.findById(targetFeed.id);
      assert.ok(updated);
      assert.ok(updated.externalProperties);
      assert.strictEqual(updated.externalProperties.length, 1);
      assert.strictEqual(
        updated.externalProperties[0]!.sourceField,
        "description",
      );
      assert.strictEqual(
        updated.externalProperties[0]!.cssSelector,
        ".content",
      );
      assert.strictEqual(updated.externalProperties[0]!.label, "Content");
      assert.ok(updated.externalProperties[0]!.id !== sourcePropertyId);
    });

    it("copies DateChecks settings", async () => {
      const ctx = await harness.createContext();

      const sourceFeed = await ctx.createFeed({ title: "Source Feed" });
      await ctx.setFields(sourceFeed.id, {
        dateCheckOptions: { oldArticleDateDiffMsThreshold: 86400000 },
      });

      const targetFeed = await ctx.createFeed({ title: "Target Feed" });

      const updatedSource = await ctx.findById(sourceFeed.id);
      assert.ok(updatedSource);

      await ctx.service.copySettings({
        sourceFeed: updatedSource,
        dto: {
          settings: [UserFeedCopyableSetting.DateChecks],
          targetFeedIds: [targetFeed.id],
          targetFeedSelectionType: UserFeedTargetFeedSelectionType.Selected,
        },
        discordUserId: ctx.discordUserId,
      });

      const updated = await ctx.findById(targetFeed.id);
      assert.ok(updated);
      assert.strictEqual(
        updated.dateCheckOptions?.oldArticleDateDiffMsThreshold,
        86400000,
      );
    });

    it("copies DatePlaceholderSettings (formatOptions)", async () => {
      const ctx = await harness.createContext();

      const sourceFeed = await ctx.createFeed({ title: "Source Feed" });
      await ctx.setFields(sourceFeed.id, {
        formatOptions: {
          dateFormat: "YYYY-MM-DD",
          dateTimezone: "America/New_York",
          dateLocale: "en-US",
        },
      });

      const targetFeed = await ctx.createFeed({ title: "Target Feed" });

      const updatedSource = await ctx.findById(sourceFeed.id);
      assert.ok(updatedSource);

      await ctx.service.copySettings({
        sourceFeed: updatedSource,
        dto: {
          settings: [UserFeedCopyableSetting.DatePlaceholderSettings],
          targetFeedIds: [targetFeed.id],
          targetFeedSelectionType: UserFeedTargetFeedSelectionType.Selected,
        },
        discordUserId: ctx.discordUserId,
      });

      const updated = await ctx.findById(targetFeed.id);
      assert.ok(updated);
      assert.strictEqual(updated.formatOptions?.dateFormat, "YYYY-MM-DD");
      assert.strictEqual(
        updated.formatOptions?.dateTimezone,
        "America/New_York",
      );
      assert.strictEqual(updated.formatOptions?.dateLocale, "en-US");
    });

    it("copies RefreshRate when present", async () => {
      const ctx = await harness.createContext();

      const sourceFeed = await ctx.createFeed({ title: "Source Feed" });
      await ctx.setFields(sourceFeed.id, {
        userRefreshRateSeconds: 900,
      });

      const targetFeed = await ctx.createFeed({ title: "Target Feed" });

      const updatedSource = await ctx.findById(sourceFeed.id);
      assert.ok(updatedSource);

      await ctx.service.copySettings({
        sourceFeed: updatedSource,
        dto: {
          settings: [UserFeedCopyableSetting.RefreshRate],
          targetFeedIds: [targetFeed.id],
          targetFeedSelectionType: UserFeedTargetFeedSelectionType.Selected,
        },
        discordUserId: ctx.discordUserId,
      });

      const updated = await ctx.findById(targetFeed.id);
      assert.ok(updated);
      assert.strictEqual(updated.userRefreshRateSeconds, 900);
    });

    it("unsets RefreshRate when source has none", async () => {
      const ctx = await harness.createContext();

      const sourceFeed = await ctx.createFeed({ title: "Source Feed" });

      const targetFeed = await ctx.createFeed({ title: "Target Feed" });
      await ctx.setFields(targetFeed.id, {
        userRefreshRateSeconds: 1800,
      });

      const updatedSource = await ctx.findById(sourceFeed.id);
      assert.ok(updatedSource);

      await ctx.service.copySettings({
        sourceFeed: updatedSource,
        dto: {
          settings: [UserFeedCopyableSetting.RefreshRate],
          targetFeedIds: [targetFeed.id],
          targetFeedSelectionType: UserFeedTargetFeedSelectionType.Selected,
        },
        discordUserId: ctx.discordUserId,
      });

      const updated = await ctx.findById(targetFeed.id);
      assert.ok(updated);
      assert.strictEqual(updated.userRefreshRateSeconds, undefined);
    });

    it("only updates feeds in targetFeedIds when using Selected mode", async () => {
      const ctx = await harness.createContext();

      const sourceFeed = await ctx.createFeed({ title: "Source Feed" });
      await ctx.setFields(sourceFeed.id, {
        passingComparisons: ["title"],
      });

      const targetFeed1 = await ctx.createFeed({ title: "Target 1" });
      const targetFeed2 = await ctx.createFeed({ title: "Target 2" });

      const updatedSource = await ctx.findById(sourceFeed.id);
      assert.ok(updatedSource);

      await ctx.service.copySettings({
        sourceFeed: updatedSource,
        dto: {
          settings: [UserFeedCopyableSetting.PassingComparisons],
          targetFeedIds: [targetFeed1.id],
          targetFeedSelectionType: UserFeedTargetFeedSelectionType.Selected,
        },
        discordUserId: ctx.discordUserId,
      });

      const updated1 = await ctx.findById(targetFeed1.id);
      const updated2 = await ctx.findById(targetFeed2.id);

      assert.ok(updated1);
      assert.ok(updated2);
      assert.deepStrictEqual(updated1.passingComparisons, ["title"]);
      assert.deepStrictEqual(updated2.passingComparisons, []);
    });

    it("updates all feeds matching search except source when using All mode", async () => {
      const ctx = await harness.createContext();

      const sourceFeed = await ctx.createFeed({ title: "NewsSource" });
      await ctx.setFields(sourceFeed.id, {
        passingComparisons: ["title"],
      });

      const targetFeed1 = await ctx.createFeed({ title: "NewsTarget1" });
      const targetFeed2 = await ctx.createFeed({ title: "NewsTarget2" });
      const nonMatchingFeed = await ctx.createFeed({ title: "OtherFeed" });

      const updatedSource = await ctx.findById(sourceFeed.id);
      assert.ok(updatedSource);

      await ctx.service.copySettings({
        sourceFeed: updatedSource,
        dto: {
          settings: [UserFeedCopyableSetting.PassingComparisons],
          targetFeedSelectionType: UserFeedTargetFeedSelectionType.All,
          targetFeedSearch: "News",
        },
        discordUserId: ctx.discordUserId,
      });

      const source = await ctx.findById(sourceFeed.id);
      const updated1 = await ctx.findById(targetFeed1.id);
      const updated2 = await ctx.findById(targetFeed2.id);
      const nonMatching = await ctx.findById(nonMatchingFeed.id);

      assert.ok(source);
      assert.ok(updated1);
      assert.ok(updated2);
      assert.ok(nonMatching);

      assert.deepStrictEqual(updated1.passingComparisons, ["title"]);
      assert.deepStrictEqual(updated2.passingComparisons, ["title"]);
      assert.deepStrictEqual(nonMatching.passingComparisons, []);
    });

    it("only updates feeds owned by the user", async () => {
      const ctx = await harness.createContext();

      const sourceFeed = await ctx.createFeed({ title: "Source Feed" });
      await ctx.setFields(sourceFeed.id, {
        passingComparisons: ["title"],
      });

      const ownedFeed = await ctx.createFeed({ title: "Owned Feed" });
      const otherUserId = ctx.generateId();
      const otherUserFeed = await ctx.createFeedForUser(otherUserId, {
        title: "Other User Feed",
      });

      const updatedSource = await ctx.findById(sourceFeed.id);
      assert.ok(updatedSource);

      await ctx.service.copySettings({
        sourceFeed: updatedSource,
        dto: {
          settings: [UserFeedCopyableSetting.PassingComparisons],
          targetFeedIds: [ownedFeed.id, otherUserFeed.id],
          targetFeedSelectionType: UserFeedTargetFeedSelectionType.Selected,
        },
        discordUserId: ctx.discordUserId,
      });

      const updatedOwned = await ctx.findById(ownedFeed.id);
      const updatedOther = await ctx.findById(otherUserFeed.id);

      assert.ok(updatedOwned);
      assert.ok(updatedOther);
      assert.deepStrictEqual(updatedOwned.passingComparisons, ["title"]);
      assert.deepStrictEqual(updatedOther.passingComparisons, []);
    });

    it("includes feeds where user has accepted share invite", async () => {
      const ctx = await harness.createContext();

      const sourceFeed = await ctx.createFeed({ title: "Source Feed" });
      await ctx.setFields(sourceFeed.id, {
        passingComparisons: ["title"],
      });

      const ownerId = ctx.generateId();
      const sharedFeed = await ctx.createSharedFeed(ownerId);

      const updatedSource = await ctx.findById(sourceFeed.id);
      assert.ok(updatedSource);

      await ctx.service.copySettings({
        sourceFeed: updatedSource,
        dto: {
          settings: [UserFeedCopyableSetting.PassingComparisons],
          targetFeedIds: [sharedFeed.id],
          targetFeedSelectionType: UserFeedTargetFeedSelectionType.Selected,
        },
        discordUserId: ctx.discordUserId,
      });

      const updated = await ctx.findById(sharedFeed.id);
      assert.ok(updated);
      assert.deepStrictEqual(updated.passingComparisons, ["title"]);
    });

    it("does nothing when settings array is empty", async () => {
      const ctx = await harness.createContext();

      const sourceFeed = await ctx.createFeed({ title: "Source Feed" });
      await ctx.setFields(sourceFeed.id, {
        passingComparisons: ["title"],
        blockingComparisons: ["author"],
      });

      const targetFeed = await ctx.createFeed({ title: "Target Feed" });
      await ctx.setFields(targetFeed.id, {
        passingComparisons: ["original"],
      });

      const updatedSource = await ctx.findById(sourceFeed.id);
      assert.ok(updatedSource);

      await ctx.service.copySettings({
        sourceFeed: updatedSource,
        dto: {
          settings: [],
          targetFeedIds: [targetFeed.id],
          targetFeedSelectionType: UserFeedTargetFeedSelectionType.Selected,
        },
        discordUserId: ctx.discordUserId,
      });

      const updated = await ctx.findById(targetFeed.id);
      assert.ok(updated);
      assert.deepStrictEqual(updated.passingComparisons, ["original"]);
    });

    it("copies connections to target feed with new IDs", async () => {
      const ctx = await harness.createContext();
      const sourceConnection = createMockDiscordChannelConnection();
      const sourceFeed = await ctx.createFeedWithConnections({
        connections: { discordChannels: [sourceConnection] },
      });

      const targetFeed = await ctx.createFeed({});
      const updatedSource = await ctx.findById(sourceFeed.id);
      assert.ok(updatedSource);

      await ctx.service.copySettings({
        sourceFeed: updatedSource,
        dto: {
          settings: [UserFeedCopyableSetting.Connections],
          targetFeedIds: [targetFeed.id],
          targetFeedSelectionType: UserFeedTargetFeedSelectionType.Selected,
        },
        discordUserId: ctx.discordUserId,
      });

      const updated = await ctx.findById(targetFeed.id);
      assert.ok(updated);
      assert.strictEqual(updated.connections?.discordChannels.length, 1);
      assert.notStrictEqual(
        updated.connections?.discordChannels[0]?.id,
        sourceConnection.id,
      );
      assert.strictEqual(
        updated.connections?.discordChannels[0]?.name,
        sourceConnection.name,
      );
    });

    it("copies multiple connections with unique IDs for each", async () => {
      const ctx = await harness.createContext();
      const conn1 = createMockDiscordChannelConnection();
      const conn2 = createMockDiscordChannelConnection();
      const sourceFeed = await ctx.createFeedWithConnections({
        connections: { discordChannels: [conn1, conn2] },
      });

      const targetFeed = await ctx.createFeed({});
      const updatedSource = await ctx.findById(sourceFeed.id);
      assert.ok(updatedSource);

      await ctx.service.copySettings({
        sourceFeed: updatedSource,
        dto: {
          settings: [UserFeedCopyableSetting.Connections],
          targetFeedIds: [targetFeed.id],
          targetFeedSelectionType: UserFeedTargetFeedSelectionType.Selected,
        },
        discordUserId: ctx.discordUserId,
      });

      const updated = await ctx.findById(targetFeed.id);
      assert.ok(updated);
      assert.strictEqual(updated.connections?.discordChannels.length, 2);
      const targetIds = updated.connections?.discordChannels.map((c) => c.id);
      assert.notStrictEqual(targetIds[0], conn1.id);
      assert.notStrictEqual(targetIds[1], conn2.id);
      assert.notStrictEqual(targetIds[0], targetIds[1]);
    });

    it("deletes application-owned webhooks from target feeds before copying", async () => {
      const ctx = await harness.createContext();
      const sourceFeed = await ctx.createFeedWithConnections({
        connections: {
          discordChannels: [createMockDiscordChannelConnection()],
        },
      });

      const targetFeed = await ctx.createFeedWithConnections({
        connections: {
          discordChannels: [
            createMockDiscordChannelConnection({
              details: {
                webhook: {
                  id: "wh-1",
                  guildId: "g-1",
                  token: "t-1",
                  isApplicationOwned: true,
                },
              },
            }),
          ],
        },
      });

      const updatedSource = await ctx.findById(sourceFeed.id);
      assert.ok(updatedSource);

      await ctx.service.copySettings({
        sourceFeed: updatedSource,
        dto: {
          settings: [UserFeedCopyableSetting.Connections],
          targetFeedIds: [targetFeed.id],
          targetFeedSelectionType: UserFeedTargetFeedSelectionType.Selected,
        },
        discordUserId: ctx.discordUserId,
      });

      assert.strictEqual(
        ctx.feedConnectionsDiscordChannelsService.deleteConnection.mock.callCount(),
        1,
      );
    });

    it("does not delete non-application-owned webhooks from target feeds", async () => {
      const ctx = await harness.createContext();
      const sourceFeed = await ctx.createFeedWithConnections({
        connections: {
          discordChannels: [createMockDiscordChannelConnection()],
        },
      });

      const targetFeed = await ctx.createFeedWithConnections({
        connections: {
          discordChannels: [
            createMockDiscordChannelConnection({
              details: {
                webhook: { id: "wh-1", guildId: "g-1", token: "t-1" },
              },
            }),
          ],
        },
      });

      const updatedSource = await ctx.findById(sourceFeed.id);
      assert.ok(updatedSource);

      await ctx.service.copySettings({
        sourceFeed: updatedSource,
        dto: {
          settings: [UserFeedCopyableSetting.Connections],
          targetFeedIds: [targetFeed.id],
          targetFeedSelectionType: UserFeedTargetFeedSelectionType.Selected,
        },
        discordUserId: ctx.discordUserId,
      });

      assert.strictEqual(
        ctx.feedConnectionsDiscordChannelsService.deleteConnection.mock.callCount(),
        0,
      );
    });

    it("copies connections to all matching feeds in All mode", async () => {
      const ctx = await harness.createContext();
      const sourceConn = createMockDiscordChannelConnection();
      const sourceFeed = await ctx.createFeedWithConnections({
        connections: { discordChannels: [sourceConn] },
      });

      const targetFeed1 = await ctx.createFeed({});
      const targetFeed2 = await ctx.createFeed({});

      const updatedSource = await ctx.findById(sourceFeed.id);
      assert.ok(updatedSource);

      await ctx.service.copySettings({
        sourceFeed: updatedSource,
        dto: {
          settings: [UserFeedCopyableSetting.Connections],
          targetFeedSelectionType: UserFeedTargetFeedSelectionType.All,
        },
        discordUserId: ctx.discordUserId,
      });

      const updated1 = await ctx.findById(targetFeed1.id);
      const updated2 = await ctx.findById(targetFeed2.id);
      assert.ok(updated1);
      assert.ok(updated2);
      assert.strictEqual(updated1.connections?.discordChannels.length, 1);
      assert.strictEqual(updated2.connections?.discordChannels.length, 1);

      const sourceAfter = await ctx.findById(sourceFeed.id);
      assert.ok(sourceAfter);
      assert.strictEqual(
        sourceAfter.connections?.discordChannels[0]?.id,
        sourceConn.id,
      );
    });

    it("replaces target connections with empty array when source has none", async () => {
      const ctx = await harness.createContext();
      const sourceFeed = await ctx.createFeed({});

      const targetFeed = await ctx.createFeedWithConnections({
        connections: {
          discordChannels: [createMockDiscordChannelConnection()],
        },
      });

      const updatedSource = await ctx.findById(sourceFeed.id);
      assert.ok(updatedSource);

      await ctx.service.copySettings({
        sourceFeed: updatedSource,
        dto: {
          settings: [UserFeedCopyableSetting.Connections],
          targetFeedIds: [targetFeed.id],
          targetFeedSelectionType: UserFeedTargetFeedSelectionType.Selected,
        },
        discordUserId: ctx.discordUserId,
      });

      const updated = await ctx.findById(targetFeed.id);
      assert.ok(updated);
      assert.strictEqual(updated.connections?.discordChannels.length, 0);
    });
  });
});
