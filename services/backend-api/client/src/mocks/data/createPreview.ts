import { CreatePreviewResult, SendTestArticleDeliveryStatus } from "@/types";

export const mockCreatePreviewResult: CreatePreviewResult = {
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
            url: "https://example.com/image.png",
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
