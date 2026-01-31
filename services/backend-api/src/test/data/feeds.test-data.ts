import { Feed } from "../../features/feeds/entities/feed.entity";
import { Types } from "mongoose";

const boilerplate: Feed = {
  _id: new Types.ObjectId(),
  channel: "channel-1",
  guild: "guild-1",
  title: "title-1",
  url: "https://www.somefakefeed.com/rss",
  text: "text-1",
  addedAt: new Date(),
  connections: {
    discordChannels: [],
  },
  embeds: [
    {
      authorIconURL: "author-icon-url-1",
      authorName: "author-name-1",
      authorURL: "author-url-1",
      color: "10",
      description: "description-1",
      fields: [
        {
          name: "field-name-1",
          value: "field-value-1",
          inline: false,
        },
        {
          name: "field-name-2",
          value: "field-value-2",
        },
      ],
      footerIconURL: "footer-icon-url-1",
      footerText: "footer-text-1",
      imageURL: "image-url-1",
      thumbnailURL: "thumbnail-url-1",
      timestamp: "now",
      title: "title-1",
      url: "url-1",
      webhook: {
        id: "webhook-id-1",
        avatar: "webhook-avatar-1",
        disabled: false,
        name: "webhook-name-1",
        url: "webhook-url-1",
      },
    },
  ],
};

export const createTestFeed = (override?: Partial<Feed>): Feed => ({
  ...boilerplate,
  _id: new Types.ObjectId(),
  ...override,
});
