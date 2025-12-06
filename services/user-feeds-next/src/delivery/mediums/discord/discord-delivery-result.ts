/**
 * Discord Delivery Result Service
 *
 * Handles parsing Discord API responses into ArticleDeliveryState objects.
 * Matches user-feeds discord-delivery-result.service.ts patterns.
 */

import type { Article } from "../../../article-parser";
import {
  ArticleDeliveryContentType,
  ArticleDeliveryErrorCode,
  ArticleDeliveryStatus,
  generateDeliveryId,
  type ArticleDeliveryState,
} from "../../../delivery-record-store";
import type { DiscordApiResponse } from "./discord-api-client";

/**
 * Parse a thread creation API response into delivery states.
 * Matches discord-delivery-result.service.ts parseThreadCreateResponseToDeliveryStates.
 */
export function parseThreadCreateResponseToDeliveryStates(
  response: DiscordApiResponse,
  article: Article,
  mediumId: string,
  contentType: ArticleDeliveryContentType
): ArticleDeliveryState[] {
  if (!response.success) {
    throw new Error(
      `Failed to create thread for medium ${mediumId}: ${
        response.detail
      }. Body: ${JSON.stringify(response.body)}`
    );
  }

  if (response.status === 404) {
    return [
      {
        id: generateDeliveryId(),
        status: ArticleDeliveryStatus.Rejected,
        mediumId,
        contentType,
        articleIdHash: article.flattened.idHash,
        errorCode: ArticleDeliveryErrorCode.NoChannelOrWebhook,
        internalMessage: `Response: ${JSON.stringify(response.body)}`,
        externalDetail:
          "Unknown channel. Update the connection to use a different channel.",
        article,
      },
    ];
  }

  if (response.status === 403) {
    return [
      {
        id: generateDeliveryId(),
        status: ArticleDeliveryStatus.Rejected,
        mediumId,
        contentType,
        articleIdHash: article.flattened.idHash,
        errorCode: ArticleDeliveryErrorCode.ThirdPartyForbidden,
        internalMessage: `Response: ${JSON.stringify(response.body)}`,
        externalDetail: "Missing permissions",
        article,
      },
    ];
  }

  if (response.status === 400) {
    return [
      {
        id: generateDeliveryId(),
        status: ArticleDeliveryStatus.Rejected,
        mediumId,
        contentType,
        articleIdHash: article.flattened.idHash,
        errorCode: ArticleDeliveryErrorCode.ThirdPartyBadRequest,
        internalMessage: `Response: ${JSON.stringify(response.body)}`,
        externalDetail: JSON.stringify(response.body, null, 2),
        article,
      },
    ];
  }

  if (response.status > 300 || response.status < 200) {
    return [
      {
        id: generateDeliveryId(),
        status: ArticleDeliveryStatus.Failed,
        mediumId,
        articleIdHash: article.flattened.idHash,
        errorCode: ArticleDeliveryErrorCode.ThirdPartyBadRequest,
        internalMessage: `Response: ${JSON.stringify(response.body)}`,
        article,
      },
    ];
  }

  return [
    {
      id: generateDeliveryId(),
      status: ArticleDeliveryStatus.Sent,
      mediumId,
      contentType,
      articleIdHash: article.flattened.idHash,
      article,
    },
  ];
}
