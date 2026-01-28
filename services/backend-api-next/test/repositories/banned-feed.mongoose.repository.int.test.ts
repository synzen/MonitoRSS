import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { createBannedFeedRepositoryHarness } from "../helpers/banned-feed.repository.int.harness";

describe(
  "BannedFeedMongooseRepository Integration",
  { concurrency: true },
  () => {
    const harness = createBannedFeedRepositoryHarness();

    before(() => harness.setup());
    after(() => harness.teardown());

    describe("findByUrlForGuild", { concurrency: true }, () => {
      it("returns null when no banned feed exists", async () => {
        const ctx = harness.createContext();
        const uniqueUrl = ctx.generateUrl();

        const result = await ctx.repository.findByUrlForGuild(
          uniqueUrl,
          ctx.guildId,
        );

        assert.strictEqual(result, null);
      });

      it("returns null when URL does not match", async () => {
        const ctx = harness.createContext();
        const searchUrl = ctx.generateUrl();

        await ctx.createBannedFeed({ url: ctx.generateUrl() });

        const result = await ctx.repository.findByUrlForGuild(
          searchUrl,
          ctx.guildId,
        );

        assert.strictEqual(result, null);
      });

      it("returns null when banned feed exists for different guild", async () => {
        const ctx1 = harness.createContext();
        const ctx2 = harness.createContext();
        const sharedUrl = ctx1.generateUrl();

        await ctx1.createBannedFeed({
          url: sharedUrl,
          guildIds: [ctx1.guildId],
        });

        const result = await ctx1.repository.findByUrlForGuild(
          sharedUrl,
          ctx2.guildId,
        );

        assert.strictEqual(result, null);
      });

      it("returns banned feed when URL matches and guildIds includes the guild", async () => {
        const ctx = harness.createContext();
        const url = ctx.generateUrl();

        await ctx.createBannedFeed({
          url,
          reason: "spam source",
          guildIds: [ctx.guildId, "other-guild"],
        });

        const result = await ctx.repository.findByUrlForGuild(url, ctx.guildId);

        assert.notStrictEqual(result, null);
        assert.strictEqual(result?.url, url);
        assert.strictEqual(result?.reason, "spam source");
      });

      it("returns banned feed when guildIds is empty (global ban)", async () => {
        const ctx = harness.createContext();
        const url = ctx.generateUrl();

        await ctx.createBannedFeed({
          url,
          reason: "malware distribution",
          guildIds: [],
        });

        const result = await ctx.repository.findByUrlForGuild(
          url,
          "any-guild-id",
        );

        assert.notStrictEqual(result, null);
        assert.strictEqual(result?.url, url);
        assert.strictEqual(result?.reason, "malware distribution");
      });

      it("returns guild-specific ban over global ban when both exist", async () => {
        const ctx = harness.createContext();
        const url = ctx.generateUrl();

        await ctx.createBannedFeed({
          url,
          reason: "global reason",
          guildIds: [],
        });

        await ctx.createBannedFeed({
          url,
          reason: "guild-specific reason",
          guildIds: [ctx.guildId],
        });

        const result = await ctx.repository.findByUrlForGuild(url, ctx.guildId);

        assert.notStrictEqual(result, null);
      });
    });
  },
);
