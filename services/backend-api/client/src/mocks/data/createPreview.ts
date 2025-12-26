import { CreatePreviewResult, SendTestArticleDeliveryStatus } from "@/types";

// eslint-disable-next-line no-bitwise
const DISCORD_COMPONENTS_V2_FLAG = 1 << 15;

const legacyPreviewResult: CreatePreviewResult = {
  status: SendTestArticleDeliveryStatus.Success,
  messages: [
    {
      content: "**Hello world**\n```my code block```\n\n:smile:\n\n**bold**",
      embeds: [
        {
          author: {
            name: "Author name",
            icon_url: "https://example.com/icon.png",
            url: "https://example.com",
          },
          color: 0x00ff00,
          description: "Description",
          fields: [
            {
              name: "Field 1",
              value: "Value 1",
              inline: true,
            },
          ],
          footer: {
            text: "Footer text",
            icon_url: "https://example.com/icon.png",
          },
          image: {
            url: "https://placehold.co/600x400",
          },
          thumbnail: {
            url: "https://example.com/thumbnail.png",
          },
          timestamp: "2021-01-01T00:00:00.000Z",
          title: "Title",
          url: "https://example.com",
        },
      ],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5,
              label:
                "label label label label label label label label label label label label label label label label label label label ",
              url: "https://www.google.com",
            },
            {
              type: 2,
              style: 5,
              label: "label",
              url: "https://www.google.com",
            },
          ],
        },
      ],
    },
  ],
};

// V2 components have a different structure than the typed schema allows,
// so we cast to CreatePreviewResult since this is mock data simulating the actual API response
const v2PreviewResult = {
  status: SendTestArticleDeliveryStatus.Success,
  messages: [
    {
      flags: DISCORD_COMPONENTS_V2_FLAG,
      components: [
        {
          type: 17, // Container
          accent_color: 0x5865f2,
          spoiler: false,
          components: [
            {
              type: 10, // TextDisplay
              content: "**Welcome to the Media Gallery Preview**",
            },
            {
              type: 14, // Separator
              divider: true,
              spacing: 1,
            },
            {
              type: 9, // Section
              components: [
                {
                  type: 10, // TextDisplay
                  content: "This is a section with a thumbnail accessory",
                },
              ],
              accessory: {
                type: 11, // Thumbnail
                media: {
                  url: "https://placehold.co/80x80",
                },
                description: "Thumbnail image",
                spoiler: false,
              },
            },
            {
              type: 14, // Separator
              divider: true,
              spacing: 2,
            },
            {
              type: 12, // MediaGallery
              items: [
                {
                  media: {
                    url: "https://i.bo3.no/image/388845/Skjermbilde%202025-12-21%20180341.png?c=0&h=338&w=600",
                  },
                  description: "First gallery image",
                  spoiler: false,
                },
                // {
                //   media: {
                //     url: "https://placehold.co/600x400/e74c3c/ffffff?text=Image+2",
                //   },
                //   description: "Second gallery image",
                //   spoiler: false,
                // },
                // {
                //   media: {
                //     url: "https://placehold.co/600x400/2ecc71/ffffff?text=Image+3",
                //   },
                //   description: "Third gallery image",
                //   spoiler: false,
                // },
              ],
            },
            {
              type: 14, // Separator
              divider: true,
              spacing: 1,
            },
            {
              type: 1, // ActionRow
              components: [
                {
                  type: 2, // Button
                  style: 5, // Link
                  label: "View Article",
                  url: "https://www.example.com",
                },
                {
                  type: 2, // Button
                  style: 2, // Secondary
                  label: "Share",
                  url: "https://www.example.com/share",
                },
              ],
            },
          ],
        },
      ],
    },
  ],
} as CreatePreviewResult;

export const getMockCreatePreviewResult = (useV2Components = false): CreatePreviewResult => {
  return useV2Components ? v2PreviewResult : legacyPreviewResult;
};

export const mockCreatePreviewResult: CreatePreviewResult = legacyPreviewResult;
