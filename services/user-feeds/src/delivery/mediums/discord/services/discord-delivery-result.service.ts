import { Injectable } from "@nestjs/common";
import {
  Article,
  ArticleDeliveryContentType,
  ArticleDeliveryErrorCode,
} from "../../../../shared";
import { ArticleDeliveryState, ArticleDeliveryStatus } from "../../../types";
import { DeliverArticleDetails } from "../../delivery-medium.interface";
import { generateDeliveryId } from "../../../../shared/utils/generate-delivery-id";
import { DiscordApiResponse } from "./discord-api-client.service";

@Injectable()
export class DiscordDeliveryResultService {
  parseThreadCreateResponseToDeliveryStates(
    response: DiscordApiResponse,
    article: Article,
    details: DeliverArticleDetails,
    contentType: ArticleDeliveryContentType
  ): ArticleDeliveryState[] {
    if (!response.success) {
      throw new Error(
        `Failed to create thread for medium ${details.mediumId}: ${
          response.detail
        }. Body: ${JSON.stringify(response.body)}`
      );
    } else {
      if (response.status === 404) {
        return [
          {
            id: generateDeliveryId(),
            status: ArticleDeliveryStatus.Rejected,
            mediumId: details.mediumId,
            contentType: contentType,
            articleIdHash: article.flattened.idHash,
            errorCode: ArticleDeliveryErrorCode.NoChannelOrWebhook,
            internalMessage: `Response: ${JSON.stringify(response.body)}`,
            externalDetail:
              "Unknown channel. Update the connection to use a different channel.",
            article,
          },
        ];
      } else if (response.status === 403) {
        return [
          {
            id: generateDeliveryId(),
            status: ArticleDeliveryStatus.Rejected,
            mediumId: details.mediumId,
            contentType: contentType,
            articleIdHash: article.flattened.idHash,
            errorCode: ArticleDeliveryErrorCode.ThirdPartyForbidden,
            internalMessage: `Response: ${JSON.stringify(response.body)}`,
            externalDetail: "Missing permissions",
            article,
          },
        ];
      } else if (response.status === 400) {
        return [
          {
            id: generateDeliveryId(),
            status: ArticleDeliveryStatus.Rejected,
            mediumId: details.mediumId,
            contentType: contentType,
            articleIdHash: article.flattened.idHash,
            errorCode: ArticleDeliveryErrorCode.ThirdPartyBadRequest,
            internalMessage: `Response: ${JSON.stringify(response.body)}`,
            externalDetail: JSON.stringify(response.body, null, 2),
            article,
          },
        ];
      } else if (response.status > 300 || response.status < 200) {
        return [
          {
            id: generateDeliveryId(),
            status: ArticleDeliveryStatus.Failed,
            mediumId: details.mediumId,
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
          mediumId: details.mediumId,
          contentType: contentType,
          articleIdHash: article.flattened.idHash,
          article,
        },
      ];
    }
  }
}
