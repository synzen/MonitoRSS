import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import {
  createAppTestContext,
  type AppTestContext,
} from "../../helpers/test-context";
import { generateSnowflake, generateTestId } from "../../helpers/test-id";
import { UserFeedManagerStatus } from "../../../src/repositories/shared/enums";
import type { SessionAccessToken } from "../../../src/services/discord-auth/types";

let ctx: AppTestContext;

before(async () => {
  ctx = await createAppTestContext();
});

after(async () => {
  await ctx.teardown();
});

beforeEach(() => {
  ctx.discordMockServer.clear();
});

function setupDiscordMocks(
  channelId: string,
  guildId: string,
  mockAccessToken: SessionAccessToken,
) {
  ctx.discordMockServer.registerRoute("GET", `/channels/${channelId}`, {
    status: 200,
    body: {
      id: channelId,
      guild_id: guildId,
      type: 0,
    },
  });

  ctx.discordMockServer.registerRouteForToken(
    "GET",
    "/users/@me/guilds",
    mockAccessToken.access_token,
    {
      status: 200,
      body: [
        {
          id: guildId,
          name: "Test Server",
          owner: false,
          permissions: "16",
        },
      ],
    },
  );
}

describe(
  "POST /api/v1/user-feeds/:feedId/connections/discord-channels",
  { concurrency: true },
  () => {
    it("returns 401 without authentication", async () => {
      const feedId = generateTestId();
      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feedId}/connections/discord-channels`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Test Connection" }),
        },
      );
      assert.strictEqual(response.status, 401);
    });

    it("returns 404 for non-existent feed", async () => {
      const user = await ctx.asUser(generateSnowflake());
      const nonExistentId = generateTestId();

      const response = await user.fetch(
        `/api/v1/user-feeds/${nonExistentId}/connections/discord-channels`,
        {
          method: "POST",
          body: JSON.stringify({
            name: "Test Connection",
            channelId: generateSnowflake(),
          }),
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 404 for feed owned by different user", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const otherDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(otherDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Other User Feed",
        url: "https://example.com/other-user-feed.xml",
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/connections/discord-channels`,
        {
          method: "POST",
          body: JSON.stringify({
            name: "Test Connection",
            channelId: generateSnowflake(),
          }),
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("creates connection with channelId", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const channelId = generateSnowflake();
      const guildId = generateSnowflake();

      const feed = await ctx.container.userFeedRepository.create({
        title: "Create Connection Feed",
        url: "https://example.com/create-connection-feed.xml",
        user: { id: generateTestId(), discordUserId },
      });

      setupDiscordMocks(channelId, guildId, user.accessToken);

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/connections/discord-channels`,
        {
          method: "POST",
          body: JSON.stringify({
            name: "My Connection",
            channelId,
          }),
        },
      );

      assert.strictEqual(response.status, 201);
      const body = (await response.json()) as {
        result: {
          id: string;
          name: string;
          key: string;
          details: {
            channel?: { id: string; guildId: string };
          };
        };
      };
      assert.ok(body.result);
      assert.ok(body.result.id);
      assert.strictEqual(body.result.name, "My Connection");
      assert.strictEqual(body.result.key, "DISCORD_CHANNEL");
      assert.ok(body.result.details.channel);
      assert.strictEqual(body.result.details.channel.id, channelId);
      assert.strictEqual(body.result.details.channel.guildId, guildId);
    });

    it("creates connection as shared manager", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const managerDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(managerDiscordUserId);
      const channelId = generateSnowflake();
      const guildId = generateSnowflake();

      const feed = await ctx.container.userFeedRepository.create({
        title: "Shared Manager Feed",
        url: "https://example.com/shared-manager-feed.xml",
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
        shareManageOptions: {
          invites: [
            {
              discordUserId: managerDiscordUserId,
              status: UserFeedManagerStatus.Accepted,
            },
          ],
        },
      });

      setupDiscordMocks(channelId, guildId, user.accessToken);

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/connections/discord-channels`,
        {
          method: "POST",
          body: JSON.stringify({
            name: "Shared Manager Connection",
            channelId,
          }),
        },
      );

      assert.strictEqual(response.status, 201);
      const body = (await response.json()) as {
        result: { id: string; name: string };
      };
      assert.ok(body.result.id);
      assert.strictEqual(body.result.name, "Shared Manager Connection");
    });

    describe("input validation", { concurrency: true }, () => {
      it("rejects name longer than 250 characters", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);

        const feed = await ctx.container.userFeedRepository.create({
          title: "Validation Feed",
          url: "https://example.com/validation-long-name.xml",
          user: { id: generateTestId(), discordUserId },
        });

        const response = await user.fetch(
          `/api/v1/user-feeds/${feed.id}/connections/discord-channels`,
          {
            method: "POST",
            body: JSON.stringify({
              name: "a".repeat(251),
              channelId: generateSnowflake(),
            }),
          },
        );
        assert.strictEqual(response.status, 400);
      });

      it("rejects missing name field", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);

        const feed = await ctx.container.userFeedRepository.create({
          title: "Validation Feed",
          url: "https://example.com/validation-missing-name.xml",
          user: { id: generateTestId(), discordUserId },
        });

        const response = await user.fetch(
          `/api/v1/user-feeds/${feed.id}/connections/discord-channels`,
          {
            method: "POST",
            body: JSON.stringify({
              channelId: generateSnowflake(),
            }),
          },
        );
        assert.strictEqual(response.status, 400);
      });

      it("rejects embed with missing footer.text", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);

        const feed = await ctx.container.userFeedRepository.create({
          title: "Validation Feed",
          url: "https://example.com/validation-footer-text.xml",
          user: { id: generateTestId(), discordUserId },
        });

        const response = await user.fetch(
          `/api/v1/user-feeds/${feed.id}/connections/discord-channels`,
          {
            method: "POST",
            body: JSON.stringify({
              name: "Test",
              channelId: generateSnowflake(),
              embeds: [{ footer: {} }],
            }),
          },
        );
        assert.strictEqual(response.status, 400);
      });

      it("rejects embed with empty footer.text", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);

        const feed = await ctx.container.userFeedRepository.create({
          title: "Validation Feed",
          url: "https://example.com/validation-footer-empty.xml",
          user: { id: generateTestId(), discordUserId },
        });

        const response = await user.fetch(
          `/api/v1/user-feeds/${feed.id}/connections/discord-channels`,
          {
            method: "POST",
            body: JSON.stringify({
              name: "Test",
              channelId: generateSnowflake(),
              embeds: [{ footer: { text: "" } }],
            }),
          },
        );
        assert.strictEqual(response.status, 400);
      });

      it("rejects embed with missing author.name", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);

        const feed = await ctx.container.userFeedRepository.create({
          title: "Validation Feed",
          url: "https://example.com/validation-author-name.xml",
          user: { id: generateTestId(), discordUserId },
        });

        const response = await user.fetch(
          `/api/v1/user-feeds/${feed.id}/connections/discord-channels`,
          {
            method: "POST",
            body: JSON.stringify({
              name: "Test",
              channelId: generateSnowflake(),
              embeds: [{ author: {} }],
            }),
          },
        );
        assert.strictEqual(response.status, 400);
      });

      it("rejects embed field with missing name and value", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);

        const feed = await ctx.container.userFeedRepository.create({
          title: "Validation Feed",
          url: "https://example.com/validation-field-missing.xml",
          user: { id: generateTestId(), discordUserId },
        });

        const response = await user.fetch(
          `/api/v1/user-feeds/${feed.id}/connections/discord-channels`,
          {
            method: "POST",
            body: JSON.stringify({
              name: "Test",
              channelId: generateSnowflake(),
              embeds: [{ fields: [{}] }],
            }),
          },
        );
        assert.strictEqual(response.status, 400);
      });

      it("rejects embed with missing image.url", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);

        const feed = await ctx.container.userFeedRepository.create({
          title: "Validation Feed",
          url: "https://example.com/validation-image-url.xml",
          user: { id: generateTestId(), discordUserId },
        });

        const response = await user.fetch(
          `/api/v1/user-feeds/${feed.id}/connections/discord-channels`,
          {
            method: "POST",
            body: JSON.stringify({
              name: "Test",
              channelId: generateSnowflake(),
              embeds: [{ image: {} }],
            }),
          },
        );
        assert.strictEqual(response.status, 400);
      });

      it("rejects embed with invalid timestamp value", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);

        const feed = await ctx.container.userFeedRepository.create({
          title: "Validation Feed",
          url: "https://example.com/validation-timestamp.xml",
          user: { id: generateTestId(), discordUserId },
        });

        const response = await user.fetch(
          `/api/v1/user-feeds/${feed.id}/connections/discord-channels`,
          {
            method: "POST",
            body: JSON.stringify({
              name: "Test",
              channelId: generateSnowflake(),
              embeds: [{ timestamp: "invalid" }],
            }),
          },
        );
        assert.strictEqual(response.status, 400);
      });

      it("accepts embed with valid timestamp values", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const channelId = generateSnowflake();
        const guildId = generateSnowflake();

        const feed = await ctx.container.userFeedRepository.create({
          title: "Validation Feed",
          url: "https://example.com/validation-timestamp-valid.xml",
          user: { id: generateTestId(), discordUserId },
        });

        setupDiscordMocks(channelId, guildId, user.accessToken);

        for (const timestamp of ["now", "article", ""]) {
          const response = await user.fetch(
            `/api/v1/user-feeds/${feed.id}/connections/discord-channels`,
            {
              method: "POST",
              body: JSON.stringify({
                name: `Timestamp ${timestamp || "empty"}`,
                channelId,
                embeds: [{ timestamp }],
              }),
            },
          );
          assert.strictEqual(
            response.status,
            201,
            `Expected 201 for timestamp "${timestamp}", got ${response.status}`,
          );
        }
      });

      it("rejects placeholderLimits with characterCount 0", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);

        const feed = await ctx.container.userFeedRepository.create({
          title: "Validation Feed",
          url: "https://example.com/validation-placeholder-count.xml",
          user: { id: generateTestId(), discordUserId },
        });

        const response = await user.fetch(
          `/api/v1/user-feeds/${feed.id}/connections/discord-channels`,
          {
            method: "POST",
            body: JSON.stringify({
              name: "Test",
              channelId: generateSnowflake(),
              placeholderLimits: [{ placeholder: "title", characterCount: 0 }],
            }),
          },
        );
        assert.strictEqual(response.status, 400);
      });

      it("rejects placeholderLimits with empty placeholder string", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);

        const feed = await ctx.container.userFeedRepository.create({
          title: "Validation Feed",
          url: "https://example.com/validation-placeholder-empty.xml",
          user: { id: generateTestId(), discordUserId },
        });

        const response = await user.fetch(
          `/api/v1/user-feeds/${feed.id}/connections/discord-channels`,
          {
            method: "POST",
            body: JSON.stringify({
              name: "Test",
              channelId: generateSnowflake(),
              placeholderLimits: [{ placeholder: "", characterCount: 10 }],
            }),
          },
        );
        assert.strictEqual(response.status, 400);
      });

      it("rejects empty name string", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);

        const feed = await ctx.container.userFeedRepository.create({
          title: "Validation Feed",
          url: "https://example.com/validation-empty-name.xml",
          user: { id: generateTestId(), discordUserId },
        });

        const response = await user.fetch(
          `/api/v1/user-feeds/${feed.id}/connections/discord-channels`,
          {
            method: "POST",
            body: JSON.stringify({
              name: "",
              channelId: generateSnowflake(),
            }),
          },
        );
        assert.strictEqual(response.status, 400);
      });

      it("rejects embed with missing thumbnail.url", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);

        const feed = await ctx.container.userFeedRepository.create({
          title: "Validation Feed",
          url: "https://example.com/validation-thumbnail-url.xml",
          user: { id: generateTestId(), discordUserId },
        });

        const response = await user.fetch(
          `/api/v1/user-feeds/${feed.id}/connections/discord-channels`,
          {
            method: "POST",
            body: JSON.stringify({
              name: "Test",
              channelId: generateSnowflake(),
              embeds: [{ thumbnail: {} }],
            }),
          },
        );
        assert.strictEqual(response.status, 400);
      });

      it("rejects embed field with empty name", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);

        const feed = await ctx.container.userFeedRepository.create({
          title: "Validation Feed",
          url: "https://example.com/validation-field-empty-name.xml",
          user: { id: generateTestId(), discordUserId },
        });

        const response = await user.fetch(
          `/api/v1/user-feeds/${feed.id}/connections/discord-channels`,
          {
            method: "POST",
            body: JSON.stringify({
              name: "Test",
              channelId: generateSnowflake(),
              embeds: [{ fields: [{ name: "", value: "some value" }] }],
            }),
          },
        );
        assert.strictEqual(response.status, 400);
      });

      it("rejects embed field with empty value", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);

        const feed = await ctx.container.userFeedRepository.create({
          title: "Validation Feed",
          url: "https://example.com/validation-field-empty-value.xml",
          user: { id: generateTestId(), discordUserId },
        });

        const response = await user.fetch(
          `/api/v1/user-feeds/${feed.id}/connections/discord-channels`,
          {
            method: "POST",
            body: JSON.stringify({
              name: "Test",
              channelId: generateSnowflake(),
              embeds: [{ fields: [{ name: "some name", value: "" }] }],
            }),
          },
        );
        assert.strictEqual(response.status, 400);
      });

      it("rejects invalid threadCreationMethod value", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);

        const feed = await ctx.container.userFeedRepository.create({
          title: "Validation Feed",
          url: "https://example.com/validation-thread-method.xml",
          user: { id: generateTestId(), discordUserId },
        });

        const response = await user.fetch(
          `/api/v1/user-feeds/${feed.id}/connections/discord-channels`,
          {
            method: "POST",
            body: JSON.stringify({
              name: "Test",
              channelId: generateSnowflake(),
              threadCreationMethod: "invalid-value",
            }),
          },
        );
        assert.strictEqual(response.status, 400);
      });
    });

    describe("template data", { concurrency: true }, () => {
      it("creates connection with content and returns it in response", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const channelId = generateSnowflake();
        const guildId = generateSnowflake();

        const feed = await ctx.container.userFeedRepository.create({
          title: "Template Data Feed",
          url: "https://example.com/template-content.xml",
          user: { id: generateTestId(), discordUserId },
        });

        setupDiscordMocks(channelId, guildId, user.accessToken);

        const response = await user.fetch(
          `/api/v1/user-feeds/${feed.id}/connections/discord-channels`,
          {
            method: "POST",
            body: JSON.stringify({
              name: "Content Connection",
              channelId,
              content: "Hello {{title}}",
            }),
          },
        );

        assert.strictEqual(response.status, 201);
        const body = (await response.json()) as {
          result: { details: { content?: string } };
        };
        assert.strictEqual(body.result.details.content, "Hello {{title}}");
      });

      it("creates connection with embeds and returns them in response", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const channelId = generateSnowflake();
        const guildId = generateSnowflake();

        const feed = await ctx.container.userFeedRepository.create({
          title: "Template Data Feed",
          url: "https://example.com/template-embeds.xml",
          user: { id: generateTestId(), discordUserId },
        });

        setupDiscordMocks(channelId, guildId, user.accessToken);

        const response = await user.fetch(
          `/api/v1/user-feeds/${feed.id}/connections/discord-channels`,
          {
            method: "POST",
            body: JSON.stringify({
              name: "Embeds Connection",
              channelId,
              embeds: [
                {
                  title: "My Embed",
                  description: "A description",
                },
              ],
            }),
          },
        );

        assert.strictEqual(response.status, 201);
        const body = (await response.json()) as {
          result: {
            details: {
              embeds?: Array<{ title?: string; description?: string }>;
            };
          };
        };
        assert.ok(body.result.details.embeds);
        assert.strictEqual(body.result.details.embeds.length, 1);
        const embed = body.result.details.embeds[0];
        assert.ok(embed);
        assert.strictEqual(embed.title, "My Embed");
        assert.strictEqual(embed.description, "A description");
      });

      it("creates connection with formatter options and persists them", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const channelId = generateSnowflake();
        const guildId = generateSnowflake();

        const feed = await ctx.container.userFeedRepository.create({
          title: "Template Data Feed",
          url: "https://example.com/template-formatter.xml",
          user: { id: generateTestId(), discordUserId },
        });

        setupDiscordMocks(channelId, guildId, user.accessToken);

        const response = await user.fetch(
          `/api/v1/user-feeds/${feed.id}/connections/discord-channels`,
          {
            method: "POST",
            body: JSON.stringify({
              name: "Formatter Connection",
              channelId,
              formatter: {
                formatTables: true,
                stripImages: true,
              },
            }),
          },
        );

        assert.strictEqual(response.status, 201);
        const body = (await response.json()) as {
          result: { id: string };
        };

        const updatedFeed = await ctx.container.userFeedRepository.findById(
          feed.id,
        );
        assert.ok(updatedFeed);
        const connection = updatedFeed.connections.discordChannels.find(
          (c) => c.id === body.result.id,
        );
        assert.ok(connection);
        assert.strictEqual(connection.details.formatter.formatTables, true);
        assert.strictEqual(connection.details.formatter.stripImages, true);
      });

      it("creates connection with placeholderLimits and persists them", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const channelId = generateSnowflake();
        const guildId = generateSnowflake();

        const feed = await ctx.container.userFeedRepository.create({
          title: "Template Data Feed",
          url: "https://example.com/template-placeholder-limits.xml",
          user: { id: generateTestId(), discordUserId },
        });

        setupDiscordMocks(channelId, guildId, user.accessToken);

        const response = await user.fetch(
          `/api/v1/user-feeds/${feed.id}/connections/discord-channels`,
          {
            method: "POST",
            body: JSON.stringify({
              name: "Placeholder Limits Connection",
              channelId,
              placeholderLimits: [
                {
                  placeholder: "title",
                  characterCount: 100,
                  appendString: "...",
                },
              ],
            }),
          },
        );

        assert.strictEqual(response.status, 201);
        const body = (await response.json()) as {
          result: { id: string };
        };

        const updatedFeed = await ctx.container.userFeedRepository.findById(
          feed.id,
        );
        assert.ok(updatedFeed);
        const connection = updatedFeed.connections.discordChannels.find(
          (c) => c.id === body.result.id,
        );
        assert.ok(connection);
        assert.ok(connection.details.placeholderLimits);
        assert.strictEqual(connection.details.placeholderLimits.length, 1);
        const limit = connection.details.placeholderLimits[0];
        assert.ok(limit);
        assert.strictEqual(limit.placeholder, "title");
        assert.strictEqual(limit.characterCount, 100);
        assert.strictEqual(limit.appendString, "...");
      });

      it("converts formatter null to undefined (not stored)", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const channelId = generateSnowflake();
        const guildId = generateSnowflake();

        const feed = await ctx.container.userFeedRepository.create({
          title: "Template Data Feed",
          url: "https://example.com/template-formatter-null.xml",
          user: { id: generateTestId(), discordUserId },
        });

        setupDiscordMocks(channelId, guildId, user.accessToken);

        const response = await user.fetch(
          `/api/v1/user-feeds/${feed.id}/connections/discord-channels`,
          {
            method: "POST",
            body: JSON.stringify({
              name: "Null Formatter Connection",
              channelId,
              formatter: null,
            }),
          },
        );

        assert.strictEqual(response.status, 201);
        const body = (await response.json()) as {
          result: { id: string };
        };

        const updatedFeed = await ctx.container.userFeedRepository.findById(
          feed.id,
        );
        assert.ok(updatedFeed);
        const connection = updatedFeed.connections.discordChannels.find(
          (c) => c.id === body.result.id,
        );
        assert.ok(connection);
        assert.strictEqual(connection.details.formatter.formatTables, false);
        assert.strictEqual(connection.details.formatter.stripImages, false);
      });
    });

    describe("discord API error handling", { concurrency: true }, () => {
      it("returns 400 FEED_MISSING_CHANNEL when channel does not exist", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const channelId = generateSnowflake();

        const feed = await ctx.container.userFeedRepository.create({
          title: "Channel Not Found Feed",
          url: "https://example.com/channel-not-found.xml",
          user: { id: generateTestId(), discordUserId },
        });

        ctx.discordMockServer.registerRoute("GET", `/channels/${channelId}`, {
          status: 404,
          body: { message: "Unknown Channel" },
        });

        const response = await user.fetch(
          `/api/v1/user-feeds/${feed.id}/connections/discord-channels`,
          {
            method: "POST",
            body: JSON.stringify({ name: "Test", channelId }),
          },
        );

        assert.strictEqual(response.status, 400);
        const body = (await response.json()) as { code: string };
        assert.strictEqual(body.code, "FEED_MISSING_CHANNEL");
      });

      it("returns 400 FEED_MISSING_CHANNEL_PERMISSION when bot lacks channel permissions", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const channelId = generateSnowflake();

        const feed = await ctx.container.userFeedRepository.create({
          title: "Channel Forbidden Feed",
          url: "https://example.com/channel-forbidden.xml",
          user: { id: generateTestId(), discordUserId },
        });

        ctx.discordMockServer.registerRoute("GET", `/channels/${channelId}`, {
          status: 403,
          body: { message: "Missing Permissions" },
        });

        const response = await user.fetch(
          `/api/v1/user-feeds/${feed.id}/connections/discord-channels`,
          {
            method: "POST",
            body: JSON.stringify({ name: "Test", channelId }),
          },
        );

        assert.strictEqual(response.status, 400);
        const body = (await response.json()) as { code: string };
        assert.strictEqual(body.code, "FEED_MISSING_CHANNEL_PERMISSION");
      });

      it("returns 403 FEED_USER_MISSING_MANAGE_GUILD when user does not manage guild", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const channelId = generateSnowflake();
        const guildId = generateSnowflake();

        const feed = await ctx.container.userFeedRepository.create({
          title: "User Not Manager Feed",
          url: "https://example.com/user-not-manager.xml",
          user: { id: generateTestId(), discordUserId },
        });

        ctx.discordMockServer.registerRoute("GET", `/channels/${channelId}`, {
          status: 200,
          body: { id: channelId, guild_id: guildId, type: 0 },
        });

        ctx.discordMockServer.registerRouteForToken(
          "GET",
          "/users/@me/guilds",
          user.accessToken.access_token,
          { status: 200, body: [] },
        );

        const response = await user.fetch(
          `/api/v1/user-feeds/${feed.id}/connections/discord-channels`,
          {
            method: "POST",
            body: JSON.stringify({ name: "Test", channelId }),
          },
        );

        assert.strictEqual(response.status, 403);
        const body = (await response.json()) as { code: string };
        assert.strictEqual(body.code, "FEED_USER_MISSING_MANAGE_GUILD");
      });

      it("returns 400 INSUFFICIENT_SUPPORTER_LEVEL for non-supporter creating webhook connection", async () => {
        let supporterCtx: AppTestContext;

        try {
          supporterCtx = await createAppTestContext({
            configOverrides: { BACKEND_API_ENABLE_SUPPORTERS: true },
          });

          const discordUserId = generateSnowflake();
          const user = await supporterCtx.asUser(discordUserId);
          const webhookId = generateSnowflake();

          const feed = await supporterCtx.container.userFeedRepository.create({
            title: "Non Supporter Webhook Feed",
            url: "https://example.com/non-supporter-webhook.xml",
            user: { id: generateTestId(), discordUserId },
          });

          const response = await user.fetch(
            `/api/v1/user-feeds/${feed.id}/connections/discord-channels`,
            {
              method: "POST",
              body: JSON.stringify({
                name: "Webhook Connection",
                webhook: { id: webhookId },
              }),
            },
          );

          assert.strictEqual(response.status, 400);
          const body = (await response.json()) as { code: string };
          assert.strictEqual(body.code, "INSUFFICIENT_SUPPORTER_LEVEL");
        } finally {
          await supporterCtx!.teardown();
        }
      });

      it("returns 403 WEBHOOKS_MANAGE_MISSING_PERMISSIONS when bot cannot access webhook", async () => {
        let supporterCtx: AppTestContext;

        try {
          supporterCtx = await createAppTestContext({
            configOverrides: { BACKEND_API_ENABLE_SUPPORTERS: true },
          });

          const discordUserId = generateSnowflake();
          const user = await supporterCtx.asUser(discordUserId);
          const webhookId = generateSnowflake();

          const feed = await supporterCtx.container.userFeedRepository.create({
            title: "Webhook Forbidden Feed",
            url: "https://example.com/webhook-forbidden.xml",
            user: { id: generateTestId(), discordUserId },
          });

          await supporterCtx.createSupporter({
            id: discordUserId,
            expireAt: new Date("2030-12-31"),
          });

          supporterCtx.discordMockServer.registerRoute(
            "GET",
            `/webhooks/${webhookId}`,
            { status: 403, body: { message: "Missing Permissions" } },
          );

          const response = await user.fetch(
            `/api/v1/user-feeds/${feed.id}/connections/discord-channels`,
            {
              method: "POST",
              body: JSON.stringify({
                name: "Webhook Connection",
                webhook: { id: webhookId },
              }),
            },
          );

          assert.strictEqual(response.status, 403);
          const body = (await response.json()) as { code: string };
          assert.strictEqual(body.code, "WEBHOOKS_MANAGE_MISSING_PERMISSIONS");
        } finally {
          await supporterCtx!.teardown();
        }
      });
    });
  },
);
