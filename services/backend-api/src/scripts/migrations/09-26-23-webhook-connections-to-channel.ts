/* eslint-disable no-console */
import { getApplicationContext } from "..";
import { UserFeed, UserFeedModel } from "../../features/user-feeds/entities";
import { getModelToken } from "@nestjs/mongoose";
import { DiscordChannelConnection } from "../../features/feeds/entities/feed-connections";
import { writeFileSync } from "fs";

async function main() {
  try {
    const { app } = await getApplicationContext();

    const userFeeds = app.get<UserFeedModel>(getModelToken(UserFeed.name));

    await userFeeds
      .find({
        "connections.discordWebhooks.0": {
          $exists: true,
        },
      })
      .cursor()
      .eachAsync(async (doc) => {
        const discordWebhookConnections = doc.connections.discordWebhooks;

        writeFileSync(
          `./updates/${doc._id}_backup.json`,
          JSON.stringify(doc, null, 2)
        );

        const channelConnectionsToSave: DiscordChannelConnection[] =
          discordWebhookConnections.map((c) => {
            return {
              id: c.id,
              name: c.name,
              createdAt: c.createdAt,
              updatedAt: c.updatedAt,
              filters: c.filters,
              rateLimits: c.rateLimits,
              mentions: c.mentions,
              splitOptions: c.splitOptions,
              disabledCode: c.disabledCode,
              customPlaceholders: c.customPlaceholders,
              details: {
                embeds: c.details.embeds,
                content: c.details.content,
                formatter: {
                  disableImageLinkPreviews:
                    c.details.formatter?.disableImageLinkPreviews,
                  formatTables: c.details.formatter?.formatTables,
                  stripImages: c.details.formatter?.stripImages,
                },
                forumThreadTitle: c.details.forumThreadTitle,
                placeholderLimits: c.details.placeholderLimits,
                webhook: c.details.webhook,
                enablePlaceholderFallback: c.details.enablePlaceholderFallback,
              },
            };
          });

        doc.connections.discordChannels.push(...channelConnectionsToSave);

        doc.connections.discordWebhooks = [];

        writeFileSync(
          `./updates/${doc._id}.json`,
          JSON.stringify(doc, null, 2)
        );
        await doc.save();
      })
      .then(() => {
        console.log("done");
        process.exit(0);
      });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
